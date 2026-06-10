import { PrismaClient, Role, ProductStatus, KeyStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const saltRounds = 10;
  const commonPassword = await bcrypt.hash('password123', saltRounds);

  console.log('[INFO] Limpiando base de datos: órdenes, transacciones, keys, carritos y productos.');
  
  // Limpieza en orden inverso de dependencias para evitar errores de Foreign Keys
  await prisma.transaction.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.shippingAddress.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.digitalKey.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.wishlistItem.deleteMany({});
  await prisma.wishlist.deleteMany({});
  await prisma.reviewHelpfulVote.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.productRequirement.deleteMany({});
  await prisma.bundleItem.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.sellerProfile.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.platform.deleteMany({});
  await prisma.genre.deleteMany({});

  console.log('[INFO] Creando usuarios base: buyer, seller y admin.');
  
  const buyerId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const sellerId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const adminId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  // Buyer verificado
  const buyer = await prisma.user.create({
    data: {
      id: buyerId,
      email: 'buyer@4fun.test',
      password: commonPassword,
      name: 'Comprador Test',
      role: Role.BUYER,
      isVerified: true,
    },
  });

  // Seller verificado
  const seller = await prisma.user.create({
    data: {
      id: sellerId,
      email: 'seller@4fun.test',
      password: commonPassword,
      name: 'Vendedor Test',
      role: Role.SELLER,
      isVerified: true,
    },
  });

  // Perfil del Seller aprobado
  await prisma.sellerProfile.create({
    data: {
      id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23',
      userId: sellerId,
      storeName: '4Fun Games Store',
      storeDescription: 'Tienda de pruebas oficial de 4Fun Store',
      isApproved: true,
    },
  });

  // Admin verificado
  const admin = await prisma.user.create({
    data: {
      id: adminId,
      email: 'admin@4fun.test',
      password: commonPassword,
      name: 'Administrador Test',
      role: Role.ADMIN,
      isVerified: true,
    },
  });

  console.log('[INFO] Creando catálogo base: plataformas y géneros.');

  const platformPcId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
  await prisma.platform.create({
    data: {
      id: platformPcId,
      slug: 'pc',
      name: 'PC',
      isActive: true,
    },
  });

  const genreRpgId = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';
  await prisma.genre.create({
    data: {
      id: genreRpgId,
      slug: 'rpg',
      name: 'RPG',
      isActive: true,
    },
  });

  const genreAventuraId = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66';
  await prisma.genre.create({
    data: {
      id: genreAventuraId,
      slug: 'aventura',
      name: 'Aventura',
      isActive: true,
    },
  });

  console.log('[INFO] Creando productos digitales.');

  const prodSpaceRiftId = '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const prodPixelQuestId = '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const prodNoKeysId = '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  await prisma.product.create({
    data: {
      id: prodSpaceRiftId,
      name: 'Space Rift Digital',
      description: 'Una aventura espacial única en formato digital.',
      price: 59.99,
      status: ProductStatus.ACTIVE,
      stock: 3,
      releaseDate: new Date('2026-01-01'),
      developer: 'Indie Studio',
      sellerId: sellerId,
      platformId: platformPcId,
      genreId: genreRpgId,
    },
  });

  await prisma.product.create({
    data: {
      id: prodPixelQuestId,
      name: 'Pixel Quest Digital',
      description: 'Un RPG retro pixel art desafiante.',
      price: 29.99,
      status: ProductStatus.ACTIVE,
      stock: 1,
      releaseDate: new Date('2026-02-01'),
      developer: 'Pixel Lab',
      sellerId: sellerId,
      platformId: platformPcId,
      genreId: genreRpgId,
    },
  });

  await prisma.product.create({
    data: {
      id: prodNoKeysId,
      name: 'No Keys Demo',
      description: 'Demo de juego sin stock disponible.',
      price: 0.00,
      status: ProductStatus.OUT_OF_STOCK,
      stock: 0,
      releaseDate: new Date('2026-03-01'),
      developer: 'Test Dev',
      sellerId: sellerId,
      platformId: platformPcId,
      genreId: genreRpgId,
    },
  });

  console.log('[INFO] Creando llaves digitales disponibles.');

  // 3 Keys para Space Rift
  await prisma.digitalKey.createMany({
    data: [
      { id: '20eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', productId: prodSpaceRiftId, key: 'SRD-KEY-001', status: KeyStatus.AVAILABLE },
      { id: '20eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', productId: prodSpaceRiftId, key: 'SRD-KEY-002', status: KeyStatus.AVAILABLE },
      { id: '20eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', productId: prodSpaceRiftId, key: 'SRD-KEY-003', status: KeyStatus.AVAILABLE },
    ]
  });

  // 1 Key para Pixel Quest
  await prisma.digitalKey.create({
    data: { id: '20eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', productId: prodPixelQuestId, key: 'PQD-KEY-001', status: KeyStatus.AVAILABLE }
  });

  // Crear carritos vacíos para asegurar inicialización limpia
  await prisma.cart.create({
    data: {
      id: '30eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      userId: buyerId,
    }
  });

  console.log('[OK] Seed finalizado con éxito.');
  console.log(`Comprador: ${buyer.email}`);
  console.log(`Vendedor: ${seller.email} - Aprobado: Sí`);
  console.log(`Admin: ${admin.email}`);
  console.log(`Total productos creados: 3`);
  console.log(`Total llaves disponibles: 4`);
  console.log(`Órdenes previas limpiadas: 0 existentes`);
  console.log(`Transacciones previas limpiadas: 0 existentes`);
}

main()
  .catch((e) => {
    console.error('[ERROR] Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    pool.end();
  });