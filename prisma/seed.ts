import { PrismaClient, Role, ProductType, PaymentMethod, OrderStatus, ProductStatus, RequirementType, SpecPreset, TransactionStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 Limpiando la base de datos para reinicio de flujo...');
  // El orden de borrado es crítico por las FK
  await prisma.transaction.deleteMany();
  await prisma.shippingAddress.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.digitalKey.deleteMany();
  await prisma.reviewHelpfulVote.deleteMany();
  await prisma.review.deleteMany();
  await prisma.bundleItem.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productRequirement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.platform.deleteMany();
  await prisma.genre.deleteMany();

  const saltRounds = 10;
  const commonPassword = await bcrypt.hash('password123', saltRounds);

  console.log('👤 Creando Población de Usuarios (RBAC)...');
  
  // 1. Admin Central
  const admin = await prisma.user.create({
    data: {
      email: 'admin@4fun.com',
      password: commonPassword,
      name: 'Enrique Admin',
      role: Role.ADMIN,
      isVerified: true,
      sellerProfile: {
        create: {
          storeName: '4Fun Official Store',
          storeDescription: 'La tienda oficial con los mejores lanzamientos mundiales.',
          isApproved: true,
        }
      }
    },
  });

  // 2. Vendedor A (Aprobado)
  const sellerA = await prisma.user.create({
    data: {
      email: 'seller_sony@4fun.com',
      password: commonPassword,
      name: 'Sony Interactive',
      role: Role.SELLER,
      isVerified: true,
      sellerProfile: {
        create: {
          storeName: 'PlayStation Store Official',
          storeDescription: 'Exclusivos de PlayStation para PC y Consolas.',
          isApproved: true,
        }
      }
    }
  });

  // 3. Vendedor B (Pendiente de Aprobación - Para probar flujo Admin)
  const sellerB = await prisma.user.create({
    data: {
      email: 'indie_dev@4fun.com',
      password: commonPassword,
      name: 'Lucas Indie',
      role: Role.SELLER,
      isVerified: true,
      sellerProfile: {
        create: {
          storeName: 'Lucas Indie Games',
          storeDescription: 'Juegos experimentales y joyas ocultas.',
          isApproved: false,
        }
      }
    }
  });

  // 4. Compradores Recurrentes
  const buyer1 = await prisma.user.create({
    data: {
      email: 'juan_perez@gmail.com',
      password: commonPassword,
      name: 'Juan Pérez',
      role: Role.BUYER,
      isVerified: true,
      address: 'Av. Siempre Viva 742, Springfield',
    }
  });

  const buyer2 = await prisma.user.create({
    data: {
      email: 'maria_garcia@hotmail.com',
      password: commonPassword,
      name: 'María García',
      role: Role.BUYER,
      isVerified: false, // Para probar flujos de verificación pendiente
    }
  });

  console.log('🎮 Creando Matriz de Referencias (3NF)...');
  const platforms = await Promise.all([
    prisma.platform.create({ data: { name: 'PC', slug: 'pc' } }),
    prisma.platform.create({ data: { name: 'PlayStation 5', slug: 'ps5' } }),
    prisma.platform.create({ data: { name: 'Xbox Series X', slug: 'xbox-sx' } }),
    prisma.platform.create({ data: { name: 'Nintendo Switch', slug: 'switch' } }),
  ]);

  const genres = await Promise.all([
    prisma.genre.create({ data: { name: 'Acción', slug: 'accion' } }),
    prisma.genre.create({ data: { name: 'RPG', slug: 'rpg' } }),
    prisma.genre.create({ data: { name: 'Aventura', slug: 'aventura' } }),
    prisma.genre.create({ data: { name: 'Estrategia', slug: 'estrategia' } }),
    prisma.genre.create({ data: { name: 'Deportes', slug: 'deportes' } }),
  ]);

  console.log('📦 Creando Catálogo de Productos (Composite & Strategy)...');
  
  // Producto 1: Digital, AAA, Sony
  const gow = await prisma.product.create({
    data: {
      name: 'God of War Ragnarök',
      description: 'La épica conclusión de la saga nórdica de Kratos y Atreus.',
      price: 69999.99,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2022-11-09'),
      developer: 'Santa Monica Studio',
      imageUrl: 'https://image.api.playstation.com/vulcan/ap/rnd/202207/1210/4Eps9sRncjjg9S58vImj0z96.png',
      stock: 500,
      status: ProductStatus.ACTIVE,
      specPreset: SpecPreset.HIGH,
      platformId: platforms[0].id, // PC
      genreId: genres[0].id, // Acción
      sellerId: sellerA.id,
      requirements: {
        create: [
          { type: RequirementType.MINIMUM, key: 'Procesador', value: 'Intel i5-4670k / AMD Ryzen 3 1200' },
          { type: RequirementType.MINIMUM, key: 'Memoria', value: '8 GB RAM' },
          { type: RequirementType.RECOMMENDED, key: 'Procesador', value: 'Intel i5-6600k / AMD Ryzen 5 2400' },
          { type: RequirementType.RECOMMENDED, key: 'Gráficos', value: 'NVIDIA GTX 1060 (6 GB) / AMD RX 580' },
        ]
      }
    }
  });

  // Producto 2: Físico, Nintendo
  const zelda = await prisma.product.create({
    data: {
      name: 'Zelda: Tears of the Kingdom',
      description: 'Explora los cielos y las profundidades de Hyrule en esta secuela legendaria.',
      price: 75000.00,
      type: ProductType.PHYSICAL,
      releaseDate: new Date('2023-05-12'),
      developer: 'Nintendo EPD',
      imageUrl: 'https://assets.nintendo.com/image/upload/ar_16:9,c_lpad,w_1240/b_white/f_auto/q_auto/v1/ncom/software/switch/70010000063714/be942544a04d022b7d4201062d22a57f8670c538',
      stock: 15,
      status: ProductStatus.ACTIVE,
      platformId: platforms[3].id, // Switch
      genreId: genres[2].id, // Aventura
      sellerId: admin.id,
    }
  });

  // Producto 3: Digital, Descuento, Indie
  const hollow = await prisma.product.create({
    data: {
      name: 'Hollow Knight',
      description: 'Un metroidvania desafiante en un mundo de insectos bellamente dibujado.',
      price: 1500.00,
      discountPercent: 50, // Strategy: 50% OFF
      type: ProductType.DIGITAL,
      releaseDate: new Date('2017-02-24'),
      developer: 'Team Cherry',
      imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/367520/header.jpg',
      stock: 1000,
      status: ProductStatus.ACTIVE,
      specPreset: SpecPreset.LOW,
      platformId: platforms[0].id,
      genreId: genres[0].id,
      sellerId: sellerB.id,
    }
  });

  // Producto 4: Bundle (Composite)
  const soulsBundle = await prisma.product.create({
    data: {
      name: 'Souls-Like Mega Pack',
      description: 'El paquete definitivo para los amantes del desafío.',
      price: 120000.00,
      isBundle: true,
      type: ProductType.DIGITAL,
      releaseDate: new Date(),
      developer: 'FromSoftware & Team Cherry',
      imageUrl: 'https://placehold.co/600x400?text=Souls+Pack',
      stock: 100,
      status: ProductStatus.ACTIVE,
      platformId: platforms[0].id,
      genreId: genres[1].id,
      sellerId: admin.id,
      bundleChildren: {
        create: [
          { productId: gow.id },
          { productId: hollow.id }
        ]
      }
    }
  });

  console.log('🛒 Generando Flujo de Órdenes y Transacciones (Escrow)...');

  // Orden 1: Pagada, Entregada, Comprador 1
  const order1 = await prisma.order.create({
    data: {
      userId: buyer1.id,
      status: OrderStatus.DELIVERED,
      isPaid: true,
      paidAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Hace 1 semana
      paymentMethod: PaymentMethod.MERCADOPAGO,
      shippingPrice: 0,
      totalPrice: gow.price,
      orderItems: {
        create: [
          {
            productId: gow.id,
            quantity: 1,
            unitPriceAtPurchase: gow.price, // Snapshot
          }
        ]
      },
      shippingAddress: {
        create: {
          fullName: buyer1.name,
          street: 'Av. Libertad 123',
          city: 'San Miguel de Tucumán',
          state: 'Tucumán',
          zip: '4000',
          country: 'Argentina'
        }
      },
      payment: {
        create: {
          mpPaymentId: 'MP-123456789',
          mpStatus: 'approved',
          mpPaymentType: 'credit_card',
          mpEmail: buyer1.email
        }
      },
      transaction: {
        create: {
          sellerId: sellerA.id,
          amount: gow.price,
          status: TransactionStatus.FUNDS_RELEASED, // Ya cobró el vendedor
          approvedBy: admin.id,
          approvedAt: new Date(),
        }
      }
    }
  });

  // Orden 2: Pendiente, Sin Pagar, Comprador 2
  const order2 = await prisma.order.create({
    data: {
      userId: buyer2.id,
      status: OrderStatus.PENDING,
      isPaid: false,
      paymentMethod: PaymentMethod.MERCADOPAGO,
      shippingPrice: 2500,
      totalPrice: 77500,
      orderItems: {
        create: [
          {
            productId: zelda.id,
            quantity: 1,
            unitPriceAtPurchase: 75000,
          }
        ]
      },
      shippingAddress: {
        create: {
          fullName: buyer2.name,
          street: 'Calle Falsa 123',
          city: 'CABA',
          state: 'Buenos Aires',
          zip: '1425',
          country: 'Argentina'
        }
      }
    }
  });

  // Orden 3: Pagada, Procesando (Escrow Activo)
  const order3 = await prisma.order.create({
    data: {
      userId: buyer1.id,
      status: OrderStatus.PROCESSING,
      isPaid: true,
      paidAt: new Date(),
      paymentMethod: PaymentMethod.MERCADOPAGO,
      shippingPrice: 0,
      totalPrice: 1500,
      orderItems: {
        create: [
          {
            productId: hollow.id,
            quantity: 1,
            unitPriceAtPurchase: 1500,
          }
        ]
      },
      transaction: {
        create: {
          sellerId: sellerB.id,
          amount: 1500,
          status: TransactionStatus.PENDING_APPROVAL, // Admin debe liberar los fondos
        }
      }
    }
  });

  console.log('🔑 Generando Inventario de Claves Digitales...');
  await prisma.digitalKey.createMany({
    data: [
      { key: 'GOW-XXXX-YYYY-ZZZZ', productId: gow.id, status: 'SOLD', orderId: order1.id },
      { key: 'GOW-AAAA-BBBB-CCCC', productId: gow.id, status: 'AVAILABLE' },
      { key: 'HK-1234-5678-9012', productId: hollow.id, status: 'SOLD', orderId: order3.id },
      { key: 'HK-9999-8888-7777', productId: hollow.id, status: 'AVAILABLE' },
    ]
  });

  console.log('⭐ Generando Feedback Social (Reviews)...');
  await prisma.review.create({
    data: {
      userId: buyer1.id,
      productId: gow.id,
      rating: 5,
      title: 'Obra Maestra',
      text: 'El mejor cierre para la saga. Los gráficos en PC son de otro mundo.',
      verified: true,
    }
  });

  console.log('✅ Simulación de flujo completada con éxito.');
  console.log('🚀 Sistema listo para validación de Auditoría, Escrow y Despachos.');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });