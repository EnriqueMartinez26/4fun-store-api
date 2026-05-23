import { PrismaClient, Role, PaymentMethod, OrderStatus, ProductStatus, TransactionStatus, KeyStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const saltRounds = 10;
  const buyerPassword = await bcrypt.hash('buyer123', saltRounds);

  console.log('👤 Buscando/Asegurando usuario de prueba...');
  const buyer = await prisma.user.upsert({
    where: { email: 'emartinez.03@hotmail.com' },
    update: {},
    create: {
      email: 'emartinez.03@hotmail.com',
      password: buyerPassword,
      name: 'Emiliano Martinez',
      role: Role.BUYER,
      isVerified: true,
    },
  });

  // Buscamos un administrador existente para las aprobaciones de transacciones
  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN }
  });

  console.log('🛒 Buscando productos existentes para simular compras...');
  
  // Obtenemos productos activos que tengan un vendedor asociado
  const availableProducts = await prisma.product.findMany({
    where: { 
      status: ProductStatus.ACTIVE,
      stock: { gt: 0 }
    },
    take: 3
  });

  if (availableProducts.length === 0) {
    console.log('⚠️ No se encontraron productos ACTIVOS con stock en la base de datos.');
    console.log('Frenando simulación: Asegurate de tener productos cargados manualmente o por otro medio.');
    return;
  }

  console.log(`✅ Se encontraron ${availableProducts.length} productos para la simulación.`);

  // --- SIMULACIÓN 1: Compra Completada ---
  console.log('🛠️ Creando simulación de compra completada...');
  
  const product1 = availableProducts[0];
  const product2 = availableProducts[1] || product1; // Usar el mismo si solo hay uno

  const totalOrder1 = Number(product1.price) + (availableProducts[1] ? Number(product2.price) : 0);

  const order1 = await prisma.order.create({
    data: {
      userId: buyer.id,
      totalPrice: totalOrder1,
      shippingPrice: 0,
      status: OrderStatus.DELIVERED,
      isPaid: true,
      paidAt: new Date(),
      isDelivered: true,
      deliveredAt: new Date(),
      paymentMethod: PaymentMethod.MERCADOPAGO,
      orderItems: {
        create: [
          { productId: product1.id, quantity: 1, unitPriceAtPurchase: product1.price },
          ...(availableProducts[1] ? [{ productId: product2.id, quantity: 1, unitPriceAtPurchase: product2.price }] : []),
        ]
      },
      shippingAddress: {
        create: {
          fullName: buyer.name,
          street: 'Calle Falsa 123',
          city: 'Córdoba',
          zip: '5000',
          country: 'Argentina'
        }
      }
    }
  });

  // Claves Digitales (si aplica)
  await prisma.digitalKey.create({
    data: {
      productId: product1.id,
      key: `SIM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      status: KeyStatus.SOLD,
      orderId: order1.id,
      soldAt: new Date()
    }
  });

  // Transacción de Escrow (Fondos Liberados)
  await prisma.transaction.create({
    data: {
      orderId: order1.id,
      sellerId: product1.sellerId,
      amount: totalOrder1,
      status: TransactionStatus.FUNDS_RELEASED,
      approvedAt: new Date(),
      approvedBy: admin?.id // Si no hay admin, queda en null o podrías forzar uno
    }
  });

  // --- SIMULACIÓN 2: Compra en Proceso (Pendiente de aprobación/entrega) ---
  if (availableProducts.length >= 1) {
    console.log('🛠️ Creando simulación de compra en proceso...');
    
    const productPending = availableProducts[availableProducts.length - 1];

    const order2 = await prisma.order.create({
      data: {
        userId: buyer.id,
        totalPrice: productPending.price,
        shippingPrice: 0,
        status: OrderStatus.PROCESSING,
        isPaid: true,
        paidAt: new Date(),
        paymentMethod: PaymentMethod.MERCADOPAGO,
        orderItems: {
          create: [
            { productId: productPending.id, quantity: 1, unitPriceAtPurchase: productPending.price },
          ]
        }
      }
    });

    await prisma.transaction.create({
      data: {
        orderId: order2.id,
        sellerId: productPending.sellerId,
        amount: productPending.price,
        status: TransactionStatus.PENDING_APPROVAL,
      }
    });
  }

  console.log('✨ Simulación finalizada con éxito.');
  console.log(`📧 Usuario Comprador: ${buyer.email}`);
  console.log(`🔑 Password: buyer123`);
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });