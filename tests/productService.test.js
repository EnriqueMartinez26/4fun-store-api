const ProductService = require('../services/productService');
const prisma = require('../lib/prisma');

jest.mock('../lib/prisma', () => ({
  product: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn()
  },
  platform: {
    findFirst: jest.fn()
  },
  genre: {
    findFirst: jest.fn()
  },
  digitalKey: {
    count: jest.fn()
  }
}));

describe('ProductService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProduct', () => {
    test('debe crear un producto digital correctamente', async () => {
      prisma.platform.findFirst.mockResolvedValue({ id: 'plat-1', isActive: true });
      prisma.genre.findFirst.mockResolvedValue({ id: 'genre-1', isActive: true });
      prisma.product.findFirst.mockResolvedValue({ displayOrder: 1000 });
      prisma.product.create.mockResolvedValue({
        id: 'prod-123',
        name: 'Half Life 3',
        price: 59.99,
        type: 'DIGITAL',
        status: 'DRAFT',
        sellerId: 'seller-id-123'
      });

      const result = await ProductService.createProduct({
        name: 'Half Life 3',
        price: 59.99,
        platform: 'pc',
        genre: 'action',
        sellerId: 'seller-id-123',
        active: false
      });

      expect(result.name).toBe('Half Life 3');
      expect(result.type).toBe('Digital');
      expect(prisma.product.create).toHaveBeenCalled();
    });

    test('debe cambiar estado a OUT_OF_STOCK si se intenta activar un producto digital sin keys en inventario', async () => {
      // Al actualizar a active=true:
      // Se consulta el stock disponible de keys
      prisma.digitalKey.count.mockResolvedValue(0);
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-123',
        type: 'DIGITAL',
        status: 'DRAFT',
        stock: 0
      });
      // El update final del servicio debe forzar el status a OUT_OF_STOCK si stock <= 0
      prisma.product.update.mockResolvedValue({
        id: 'prod-123',
        type: 'DIGITAL',
        status: 'OUT_OF_STOCK',
        stock: 0
      });

      const result = await ProductService.updateProduct('prod-123', { active: true });

      expect(result.status).toBe('OUT_OF_STOCK');
      expect(prisma.product.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'OUT_OF_STOCK'
        })
      }));
    });
  });

  describe('validateProductOwnershipBulk', () => {
    test('un seller no debe poder editar ni borrar un producto ajeno', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', sellerId: 'seller-abc' },
        { id: 'prod-2', sellerId: 'seller-def' }
      ]);

      const result = await ProductService.validateProductOwnershipBulk(
        ['prod-1', 'prod-2'],
        'seller-abc',
        'SELLER'
      );

      expect(result.valid).toBe(false);
      expect(result.unauthorizedIds).toContain('prod-2');
    });

    test('un admin tiene permiso global y puede editar cualquier producto', async () => {
      const result = await ProductService.validateProductOwnershipBulk(
        ['prod-1', 'prod-2'],
        'admin-xyz',
        'ADMIN'
      );

      expect(result.valid).toBe(true);
    });
  });
});
