jest.mock('../lib/prisma', () => {
  const mockPrisma = {
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn()
    },
    digitalKey: {
      count: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn()
    },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    orderItem: {
      findMany: jest.fn()
    },
    transaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    $transaction: jest.fn(callback => callback(mockPrisma))
  };
  return mockPrisma;
});

const OrderService = require('../services/orderService');
const TransactionService = require('../services/transactionService');
const prisma = require('../lib/prisma');
const orderEventBus = require('../services/observers/OrderEventBus');

jest.mock('../services/composite/ProductComponentFactory', () => ({
  create: jest.fn(product => ({
    getPrice: () => Number(product.price)
  }))
}));

jest.mock('../services/observers/OrderEventBus', () => ({
  notify: jest.fn().mockResolvedValue()
}));

describe('Order and Transaction Services', () => {
  beforeEach(() => {
    process.env.BACKEND_URL = 'http://localhost:9003';
    process.env.DISPUTE_WINDOW_DAYS = '0';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('OrderService', () => {
    test('debe arrojar error si el carrito está vacío', async () => {
      await expect(
        OrderService.createOrder({
          user: { id: 'user-1' },
          orderItems: [],
          shippingAddress: null,
          paymentMethod: 'MERCADOPAGO'
        })
      ).rejects.toThrow('El carrito está vacío.');
    });

    test('debe fallar si no hay keys disponibles para producto digital', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Game 1',
        type: 'DIGITAL',
        status: 'ACTIVE',
        price: 10
      });
      prisma.digitalKey.count.mockResolvedValue(0);

      await expect(
        OrderService.createOrder({
          user: { id: 'user-1' },
          orderItems: [{ product: 'prod-1', name: 'Game 1', quantity: 1 }],
          shippingAddress: null,
          paymentMethod: 'MERCADOPAGO'
        })
      ).rejects.toThrow('Stock insuficiente de keys');
    });

    test('debe crear una orden válida si hay keys disponibles', async () => {
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Game 1',
        type: 'DIGITAL',
        status: 'ACTIVE',
        price: 10
      });
      prisma.digitalKey.count.mockResolvedValue(5);
      prisma.order.create.mockResolvedValue({
        id: 'order-123',
        totalPrice: 10,
        status: 'PENDING'
      });

      const result = await OrderService.createOrder({
        user: { id: 'user-1' },
        orderItems: [{ product: 'prod-1', name: 'Game 1', quantity: 1 }],
        shippingAddress: null,
        paymentMethod: 'MERCADOPAGO'
      });

      expect(result.orderId).toBe('order-123');
      expect(prisma.order.create).toHaveBeenCalled();
    });

    test('debe marcar la orden como pagada y notificar el evento de pago', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-123',
        isPaid: false,
        totalPrice: 10,
        userId: 'user-1',
        orderItems: [{ productId: 'prod-1', quantity: 1, product: { type: 'DIGITAL', sellerId: 'seller-99' } }]
      });
      prisma.order.update.mockResolvedValue({
        id: 'order-123',
        isPaid: true,
        totalPrice: 10,
        userId: 'user-1',
        orderItems: [{ productId: 'prod-1', quantity: 1, product: { type: 'DIGITAL', sellerId: 'seller-99' } }]
      });

      await OrderService.updateOrderToPaid('order-123');
      expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'order-123' },
        data: expect.objectContaining({
          isPaid: true
        })
      }));
      expect(orderEventBus.notify).toHaveBeenCalledWith(
        'order:paid',
        expect.objectContaining({
          order: expect.objectContaining({ id: 'order-123', isPaid: true }),
          digitalKeys: [],
          meta: { shouldSendKeysEmail: false }
        })
      );
    });
  });

  describe('TransactionService', () => {
    test('admin aprueba la transferencia de fondos', async () => {
      const paidAt = new Date();
      prisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        status: 'PENDING_APPROVAL',
        amount: 10,
        orderId: 'order-123',
        order: { paidAt },
        seller: { name: 'Seller 1' }
      });
      prisma.orderItem.findMany.mockResolvedValue([{ unitPriceAtPurchase: 10, quantity: 1 }]);
      prisma.transaction.update.mockResolvedValue({ id: 'tx-1', status: 'FUNDS_RELEASED' });

      const tx = await TransactionService.approveFundsTransfer('tx-1', 'admin-1');
      expect(tx.status).toBe('FUNDS_RELEASED');
      expect(prisma.transaction.update).toHaveBeenCalled();
    });

    test('admin rechaza la transferencia de fondos con motivo', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        status: 'PENDING_APPROVAL',
        amount: 10,
        seller: { name: 'Seller 1' }
      });
      prisma.transaction.update.mockResolvedValue({ id: 'tx-1', status: 'REJECTED' });

      const tx = await TransactionService.rejectFundsTransfer('tx-1', 'admin-1', 'Fraude detectado');
      expect(tx.status).toBe('REJECTED');
      expect(prisma.transaction.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'tx-1' },
        data: expect.objectContaining({
          status: 'REJECTED',
          rejectionReason: 'Fraude detectado'
        })
      }));
    });

    test('un usuario no autorizado no puede ver una transacción ajena', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        sellerId: 'seller-1',
        order: { userId: 'buyer-1' }
      });

      await expect(
        TransactionService.getTransactionById('tx-1', 'intruder-1', 'BUYER')
      ).rejects.toThrow('No autorizado para ver esta transacción');
    });
  });
});
