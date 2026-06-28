import {
  KeyStatus,
  OrderStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
  ProductStatus,
  ProductType,
  RequirementType,
  Role,
  SpecPreset,
  TransactionStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run the seed.');
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type BuyerKey = 'buyerMain' | 'buyerTwo' | 'buyerThree';
type SellerKey = 'sellerMain' | 'sellerTwo';
type AdminKey = 'admin';
type UserKey = BuyerKey | SellerKey | AdminKey;

type PlatformKey = 'pc' | 'steam' | 'ps5' | 'xbox' | 'switch';
type GenreKey =
  | 'action'
  | 'adventure'
  | 'rpg'
  | 'strategy'
  | 'horror'
  | 'racing'
  | 'indie';
type ProductKey =
  | 'chronoVanguard'
  | 'neonHarbor'
  | 'skylineTactics'
  | 'titanCircuit2099'
  | 'silentDepths'
  | 'astralColony'
  | 'pocketColony'
  | 'ironHarborLegacy';
type OrderKey = 'orderOne' | 'orderTwo' | 'orderThree' | 'orderFour' | 'orderFive';
type RequirementStage = 'MINIMUM' | 'RECOMMENDED';

type RequirementSeed = {
  key: string;
  value: string;
};

type RequirementTemplate = Record<RequirementStage, RequirementSeed[]>;

type PlatformSeed = {
  key: PlatformKey;
  slug: string;
  name: string;
  imageText: string;
};

type GenreSeed = {
  key: GenreKey;
  slug: string;
  name: string;
  imageText: string;
};

type UserSeed = {
  key: UserKey;
  name: string;
  email: string;
  role: Role;
  avatarText: string;
  phone: string;
  address: string;
  sellerProfile?: {
    storeName: string;
    storeDescription: string;
    bankAccount: string;
    taxId: string;
    isApproved: boolean;
  };
};

type ProductSeed = {
  key: ProductKey;
  name: string;
  description: string;
  price: string;
  releaseDate: Date;
  developer: string;
  imageText: string;
  status: ProductStatus;
  specPreset: SpecPreset;
  discountPercent: number;
  discountEndDate: Date | null;
  displayOrder: number;
  sellerKey: SellerKey;
  platformKey: PlatformKey;
  genreKey: GenreKey;
  requirements: RequirementTemplate;
  keyPrefix: string;
  keyCount: number;
};

type OrderItemSeed = {
  productKey: ProductKey;
  quantity: number;
};

type OrderSeed = {
  key: OrderKey;
  userKey: BuyerKey;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  isPaid: boolean;
  isDelivered: boolean;
  externalId: string | null;
  createdAt: Date;
  paidAt: Date | null;
  deliveredAt: Date | null;
  items: OrderItemSeed[];
  payment?: {
    mpPaymentId: string;
    mpStatus: string;
    mpPaymentType: string;
    mpEmail: string;
  };
  transaction?: {
    status: TransactionStatus;
    approvedByKey?: AdminKey;
    approvedAt?: Date;
  };
};

type ReviewSeed = {
  productKey: ProductKey;
  userKey: BuyerKey;
  rating: number;
  title: string;
  text: string;
  createdAt: Date;
  helpfulBy: BuyerKey[];
};

const makeImageUrl = (text: string) =>
  `https://placehold.co/600x400/png?text=${encodeURIComponent(text)}`;

const makeAvatarUrl = (text: string) =>
  `https://placehold.co/128x128/png?text=${encodeURIComponent(text)}`;

const money = (value: string | number) => new Prisma.Decimal(value);

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const makeKey = (prefix: string, serial: number) => {
  const blockA = serial.toString(36).toUpperCase().padStart(4, '0');
  const blockB = ((serial * 137) % 1296).toString(36).toUpperCase().padStart(4, '0');
  const blockC = ((serial * 971) % 1296).toString(36).toUpperCase().padStart(4, '0');
  return `${prefix}-${blockA}-${blockB}-${blockC}`;
};

const calculateOrderTotal = (items: OrderItemSeed[], priceByProduct: Record<ProductKey, number>) =>
  Number(
    items
      .reduce((sum, item) => sum + priceByProduct[item.productKey] * item.quantity, 0)
      .toFixed(2),
  );

const pcLowRequirements: RequirementTemplate = {
  MINIMUM: [
    { key: 'os', value: 'Windows 10 64-bit' },
    { key: 'cpu', value: 'Intel Core i5-4460 / Ryzen 3 1200' },
    { key: 'memory', value: '8 GB RAM' },
    { key: 'graphics', value: 'GTX 750 Ti / RX 560' },
    { key: 'storage', value: '20 GB available space' },
  ],
  RECOMMENDED: [
    { key: 'os', value: 'Windows 11 64-bit' },
    { key: 'cpu', value: 'Intel Core i5-8400 / Ryzen 5 2600' },
    { key: 'memory', value: '16 GB RAM' },
    { key: 'graphics', value: 'GTX 1650 / RX 580' },
    { key: 'storage', value: '20 GB SSD' },
  ],
};

const pcMidRequirements: RequirementTemplate = {
  MINIMUM: [
    { key: 'os', value: 'Windows 10 64-bit' },
    { key: 'cpu', value: 'Intel Core i5-6600K / Ryzen 5 1400' },
    { key: 'memory', value: '12 GB RAM' },
    { key: 'graphics', value: 'GTX 1060 6 GB / RX 580' },
    { key: 'storage', value: '35 GB available space' },
  ],
  RECOMMENDED: [
    { key: 'os', value: 'Windows 11 64-bit' },
    { key: 'cpu', value: 'Intel Core i7-9700K / Ryzen 5 3600' },
    { key: 'memory', value: '16 GB RAM' },
    { key: 'graphics', value: 'RTX 2060 / RX 5600 XT' },
    { key: 'storage', value: '35 GB SSD' },
  ],
};

const pcHighRequirements: RequirementTemplate = {
  MINIMUM: [
    { key: 'os', value: 'Windows 10 64-bit' },
    { key: 'cpu', value: 'Intel Core i7-8700K / Ryzen 7 3700X' },
    { key: 'memory', value: '16 GB RAM' },
    { key: 'graphics', value: 'RTX 2060 / RX 6600 XT' },
    { key: 'storage', value: '60 GB available space' },
  ],
  RECOMMENDED: [
    { key: 'os', value: 'Windows 11 64-bit' },
    { key: 'cpu', value: 'Intel Core i7-12700K / Ryzen 7 5800X3D' },
    { key: 'memory', value: '32 GB RAM' },
    { key: 'graphics', value: 'RTX 4070 / RX 7800 XT' },
    { key: 'storage', value: '60 GB SSD' },
  ],
};

const ps5Requirements: RequirementTemplate = {
  MINIMUM: [
    { key: 'console', value: 'PlayStation 5' },
    { key: 'storage', value: '80 GB available space' },
    { key: 'network', value: 'Internet connection required for updates' },
  ],
  RECOMMENDED: [
    { key: 'console', value: 'PlayStation 5 with latest firmware' },
    { key: 'storage', value: '80 GB SSD' },
    { key: 'audio', value: '3D Audio headset recommended' },
  ],
};

const xboxRequirements: RequirementTemplate = {
  MINIMUM: [
    { key: 'console', value: 'Xbox Series X|S' },
    { key: 'storage', value: '70 GB available space' },
    { key: 'network', value: 'Online connection required' },
  ],
  RECOMMENDED: [
    { key: 'console', value: 'Xbox Series X|S with SSD' },
    { key: 'storage', value: '70 GB SSD' },
    { key: 'subscription', value: 'Multiplayer subscription optional' },
  ],
};

const switchRequirements: RequirementTemplate = {
  MINIMUM: [
    { key: 'console', value: 'Nintendo Switch' },
    { key: 'storage', value: '16 GB available space' },
    { key: 'network', value: 'Internet connection required for updates' },
  ],
  RECOMMENDED: [
    { key: 'console', value: 'Nintendo Switch OLED' },
    { key: 'storage', value: '16 GB microSD recommended' },
    { key: 'battery', value: 'Portable play recommended' },
  ],
};

const platformSeeds: PlatformSeed[] = [
  { key: 'pc', slug: 'pc', name: 'PC', imageText: 'PC' },
  { key: 'steam', slug: 'steam', name: 'Steam', imageText: 'Steam' },
  { key: 'ps5', slug: 'playstation-5', name: 'PlayStation 5', imageText: 'PS5' },
  { key: 'xbox', slug: 'xbox-series-xs', name: 'Xbox Series X|S', imageText: 'Xbox' },
  { key: 'switch', slug: 'nintendo-switch', name: 'Nintendo Switch', imageText: 'Switch' },
];

const genreSeeds: GenreSeed[] = [
  { key: 'action', slug: 'action', name: 'Action', imageText: 'Action' },
  { key: 'adventure', slug: 'adventure', name: 'Adventure', imageText: 'Adventure' },
  { key: 'rpg', slug: 'rpg', name: 'RPG', imageText: 'RPG' },
  { key: 'strategy', slug: 'strategy', name: 'Strategy', imageText: 'Strategy' },
  { key: 'horror', slug: 'horror', name: 'Horror', imageText: 'Horror' },
  { key: 'racing', slug: 'racing', name: 'Racing', imageText: 'Racing' },
  { key: 'indie', slug: 'indie', name: 'Indie', imageText: 'Indie' },
];

const userSeeds: UserSeed[] = [
  {
    key: 'buyerMain',
    name: 'Lucía Fernández',
    email: 'buyer@4fun.test',
    role: Role.BUYER,
    avatarText: 'LF',
    phone: '+54 11 5555-0101',
    address: 'Sarmiento 1450, C1041 CABA, Argentina',
  },
  {
    key: 'buyerTwo',
    name: 'Tomás Acosta',
    email: 'buyer2@4fun.test',
    role: Role.BUYER,
    avatarText: 'TA',
    phone: '+54 341 555-0202',
    address: 'Bv. Oroño 1122, Rosario, Santa Fe, Argentina',
  },
  {
    key: 'buyerThree',
    name: 'Camila Torres',
    email: 'buyer3@4fun.test',
    role: Role.BUYER,
    avatarText: 'CT',
    phone: '+54 221 555-0303',
    address: 'Diagonal 74 2215, La Plata, Buenos Aires, Argentina',
  },
  {
    key: 'sellerMain',
    name: 'Marcos Ferreyra',
    email: 'seller@4fun.test',
    role: Role.SELLER,
    avatarText: 'MF',
    phone: '+54 11 5555-0404',
    address: 'Av. Corrientes 2840, C1193 CABA, Argentina',
    sellerProfile: {
      storeName: 'Northwave Digital',
      storeDescription: 'Curated PC and console keys with fast fulfillment and strict catalog quality.',
      bankAccount: 'CBU 0720002420000001234567',
      taxId: '20-30311223-4',
      isApproved: true,
    },
  },
  {
    key: 'sellerTwo',
    name: 'Paula Pereyra',
    email: 'seller2@4fun.test',
    role: Role.SELLER,
    avatarText: 'PP',
    phone: '+54 221 555-0505',
    address: 'Calle 48 867, La Plata, Buenos Aires, Argentina',
    sellerProfile: {
      storeName: 'Pixel Forge',
      storeDescription: 'Independent and mid-tier releases with clean metadata and honest stock tracking.',
      bankAccount: 'CBU 0340002720000009876543',
      taxId: '27-31877444-8',
      isApproved: true,
    },
  },
  {
    key: 'admin',
    name: 'Valentina Ruiz',
    email: 'admin@4fun.test',
    role: Role.ADMIN,
    avatarText: 'VR',
    phone: '+54 11 5555-0606',
    address: 'Av. Belgrano 3200, C1093 CABA, Argentina',
  },
];

const productSeeds: ProductSeed[] = [
  {
    key: 'chronoVanguard',
    name: 'Chrono Vanguard',
    description:
      'A tactical sci-fi RPG with squad combat, branching decisions and a long-form campaign.',
    price: '59.99',
    releaseDate: new Date('2025-03-14T00:00:00Z'),
    developer: 'Northwave Interactive',
    imageText: 'Chrono Vanguard',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 1,
    sellerKey: 'sellerMain',
    platformKey: 'pc',
    genreKey: 'rpg',
    requirements: pcHighRequirements,
    keyPrefix: 'CVG',
    keyCount: 4,
  },
  {
    key: 'skylineTactics',
    name: 'Skyline Tactics',
    description:
      'A compact strategy title focused on turn-based squads, urban cover and replayable missions.',
    price: '24.99',
    releaseDate: new Date('2024-11-22T00:00:00Z'),
    developer: 'Northwave Interactive',
    imageText: 'Skyline Tactics',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.LOW,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 2,
    sellerKey: 'sellerMain',
    platformKey: 'pc',
    genreKey: 'strategy',
    requirements: pcLowRequirements,
    keyPrefix: 'SKY',
    keyCount: 3,
  },
  {
    key: 'neonHarbor',
    name: 'Neon Harbor',
    description:
      'A cyberpunk adventure with exploration, dialogue branches and a strong visual identity.',
    price: '34.99',
    releaseDate: new Date('2025-05-09T00:00:00Z'),
    developer: 'Northwave Interactive',
    imageText: 'Neon Harbor',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.MID,
    discountPercent: 15,
    discountEndDate: daysFromNow(12),
    displayOrder: 3,
    sellerKey: 'sellerMain',
    platformKey: 'steam',
    genreKey: 'adventure',
    requirements: pcMidRequirements,
    keyPrefix: 'NEO',
    keyCount: 4,
  },
  {
    key: 'silentDepths',
    name: 'Silent Depths',
    description:
      'A survival horror experience set inside a submerged research base with light resource management.',
    price: '69.99',
    releaseDate: new Date('2025-01-31T00:00:00Z'),
    developer: 'Pixel Forge',
    imageText: 'Silent Depths',
    status: ProductStatus.OUT_OF_STOCK,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 4,
    sellerKey: 'sellerTwo',
    platformKey: 'ps5',
    genreKey: 'horror',
    requirements: ps5Requirements,
    keyPrefix: 'SID',
    keyCount: 1,
  },
  {
    key: 'titanCircuit2099',
    name: 'Titan Circuit 2099',
    description:
      'An arcade racer with futuristic tracks, quick online events and deep vehicle tuning.',
    price: '49.99',
    releaseDate: new Date('2025-08-21T00:00:00Z'),
    developer: 'Blue Meridian',
    imageText: 'Titan Circuit 2099',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.MID,
    discountPercent: 10,
    discountEndDate: daysFromNow(9),
    displayOrder: 5,
    sellerKey: 'sellerTwo',
    platformKey: 'xbox',
    genreKey: 'racing',
    requirements: xboxRequirements,
    keyPrefix: 'TIT',
    keyCount: 4,
  },
  {
    key: 'astralColony',
    name: 'Astral Colony',
    description:
      'A cozy indie colony builder about surviving and growing a settlement on an asteroid.',
    price: '29.99',
    releaseDate: new Date('2025-12-12T00:00:00Z'),
    developer: 'Moonstone Atelier',
    imageText: 'Astral Colony',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.LOW,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 6,
    sellerKey: 'sellerTwo',
    platformKey: 'switch',
    genreKey: 'indie',
    requirements: switchRequirements,
    keyPrefix: 'AST',
    keyCount: 3,
  },
  {
    key: 'pocketColony',
    name: 'Pocket Colony',
    description:
      'A small-scale management game planned for a later release, with a friendly art direction.',
    price: '19.99',
    releaseDate: new Date('2026-09-18T00:00:00Z'),
    developer: 'Moonstone Atelier',
    imageText: 'Pocket Colony',
    status: ProductStatus.DRAFT,
    specPreset: SpecPreset.LOW,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 7,
    sellerKey: 'sellerTwo',
    platformKey: 'switch',
    genreKey: 'indie',
    requirements: switchRequirements,
    keyPrefix: 'POC',
    keyCount: 0,
  },
  {
    key: 'ironHarborLegacy',
    name: 'Iron Harbor Legacy',
    description:
      'A narrative action game kept in suspended state after moderation and catalog review.',
    price: '39.99',
    releaseDate: new Date('2024-03-15T00:00:00Z'),
    developer: 'Blue Meridian',
    imageText: 'Iron Harbor Legacy',
    status: ProductStatus.SUSPENDED,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 8,
    sellerKey: 'sellerTwo',
    platformKey: 'pc',
    genreKey: 'action',
    requirements: pcHighRequirements,
    keyPrefix: 'IRN',
    keyCount: 0,
  },
];

const productSeedByKey = Object.fromEntries(productSeeds.map((product) => [product.key, product])) as Record<
  ProductKey,
  ProductSeed
>;

const productPriceByKey = Object.fromEntries(
  productSeeds.map((product) => [product.key, Number(product.price)]),
) as Record<ProductKey, number>;

const orderSeeds: OrderSeed[] = [
  {
    key: 'orderOne',
    userKey: 'buyerMain',
    paymentMethod: PaymentMethod.MERCADOPAGO,
    status: OrderStatus.DELIVERED,
    isPaid: true,
    isDelivered: true,
    externalId: 'mp-20260607-0001',
    createdAt: daysAgo(20),
    paidAt: daysAgo(20),
    deliveredAt: daysAgo(20),
    items: [
      { productKey: 'chronoVanguard', quantity: 1 },
      { productKey: 'skylineTactics', quantity: 1 },
    ],
    payment: {
      mpPaymentId: 'pay_20260607_0001',
      mpStatus: 'approved',
      mpPaymentType: 'credit_card',
      mpEmail: 'buyer@4fun.test',
    },
    transaction: {
      status: TransactionStatus.FUNDS_RELEASED,
      approvedByKey: 'admin',
      approvedAt: daysAgo(12),
    },
  },
  {
    key: 'orderTwo',
    userKey: 'buyerTwo',
    paymentMethod: PaymentMethod.TRANSFER,
    status: OrderStatus.DELIVERED,
    isPaid: true,
    isDelivered: true,
    externalId: 'trf-20260623-0002',
    createdAt: daysAgo(4),
    paidAt: daysAgo(4),
    deliveredAt: daysAgo(4),
    items: [{ productKey: 'chronoVanguard', quantity: 1 }],
    payment: {
      mpPaymentId: 'pay_20260623_0002',
      mpStatus: 'approved',
      mpPaymentType: 'bank_transfer',
      mpEmail: 'buyer2@4fun.test',
    },
    transaction: {
      status: TransactionStatus.PENDING_APPROVAL,
    },
  },
  {
    key: 'orderThree',
    userKey: 'buyerThree',
    paymentMethod: PaymentMethod.MERCADOPAGO,
    status: OrderStatus.DELIVERED,
    isPaid: true,
    isDelivered: true,
    externalId: 'mp-20260611-0003',
    createdAt: daysAgo(16),
    paidAt: daysAgo(16),
    deliveredAt: daysAgo(16),
    items: [{ productKey: 'silentDepths', quantity: 1 }],
    payment: {
      mpPaymentId: 'pay_20260611_0003',
      mpStatus: 'approved',
      mpPaymentType: 'credit_card',
      mpEmail: 'buyer3@4fun.test',
    },
    transaction: {
      status: TransactionStatus.FUNDS_RELEASED,
      approvedByKey: 'admin',
      approvedAt: daysAgo(8),
    },
  },
  {
    key: 'orderFour',
    userKey: 'buyerMain',
    paymentMethod: PaymentMethod.MERCADOPAGO,
    status: OrderStatus.PENDING,
    isPaid: false,
    isDelivered: false,
    externalId: null,
    createdAt: daysAgo(1),
    paidAt: null,
    deliveredAt: null,
    items: [{ productKey: 'astralColony', quantity: 1 }],
  },
  {
    key: 'orderFive',
    userKey: 'buyerTwo',
    paymentMethod: PaymentMethod.TRANSFER,
    status: OrderStatus.CANCELLED,
    isPaid: false,
    isDelivered: false,
    externalId: null,
    createdAt: daysAgo(2),
    paidAt: null,
    deliveredAt: null,
    items: [{ productKey: 'titanCircuit2099', quantity: 1 }],
  },
];

const reviewSeeds: ReviewSeed[] = [
  {
    productKey: 'chronoVanguard',
    userKey: 'buyerMain',
    rating: 5,
    title: 'Táctico, exigente y muy sólido',
    text: 'Excelente ritmo, combate muy limpio y una presentación visual que sostiene la campaña completa.',
    createdAt: daysAgo(13),
    helpfulBy: ['buyerTwo', 'buyerThree'],
  },
  {
    productKey: 'skylineTactics',
    userKey: 'buyerMain',
    rating: 4,
    title: 'Ideal para partidas cortas',
    text: 'Muy buen diseño de misiones y una curva de dificultad bastante honesta para su tamaño.',
    createdAt: daysAgo(12),
    helpfulBy: ['buyerTwo'],
  },
  {
    productKey: 'chronoVanguard',
    userKey: 'buyerTwo',
    rating: 4,
    title: 'Buen ritmo y mucha identidad',
    text: 'La historia engancha y el sistema táctico tiene suficiente profundidad para volver a jugarlo.',
    createdAt: daysAgo(2),
    helpfulBy: ['buyerMain', 'buyerThree'],
  },
  {
    productKey: 'silentDepths',
    userKey: 'buyerThree',
    rating: 5,
    title: 'Horror atmosférico de verdad',
    text: 'La ambientación y el sonido hacen todo el trabajo pesado. Muy buena experiencia de terror.',
    createdAt: daysAgo(10),
    helpfulBy: ['buyerMain', 'buyerTwo'],
  },
];

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.$transaction(
    async (tx) => {
    await tx.$executeRawUnsafe('ALTER TABLE "Order" DROP COLUMN IF EXISTS "totalPrice"');
    await tx.$executeRawUnsafe('ALTER TABLE "Product" DROP COLUMN IF EXISTS "stock"');
    await tx.$executeRawUnsafe('DROP TABLE IF EXISTS "Coupon" CASCADE');
    await tx.$executeRawUnsafe('DROP TYPE IF EXISTS "DiscountType" CASCADE');

    await tx.reviewHelpfulVote.deleteMany({});
    await tx.review.deleteMany({});
    await tx.digitalKey.deleteMany({});
    await tx.payment.deleteMany({});
    await tx.transaction.deleteMany({});
    await tx.orderItem.deleteMany({});
    await tx.shippingAddress.deleteMany({});
    await tx.order.deleteMany({});
    await tx.cartItem.deleteMany({});
    await tx.cart.deleteMany({});
    await tx.wishlistItem.deleteMany({});
    await tx.wishlist.deleteMany({});
    await tx.productRequirement.deleteMany({});
    await tx.bundleItem.deleteMany({});
    await tx.product.deleteMany({});
    await tx.sellerProfile.deleteMany({});
    await tx.user.deleteMany({});
    await tx.platform.deleteMany({});
    await tx.genre.deleteMany({});

    const platformIds = {} as Record<PlatformKey, string>;
    for (const platform of platformSeeds) {
      const created = await tx.platform.create({
        data: {
          slug: platform.slug,
          name: platform.name,
          isActive: true,
          imageUrl: makeImageUrl(platform.imageText),
        },
      });
      platformIds[platform.key] = created.id;
    }

    const genreIds = {} as Record<GenreKey, string>;
    for (const genre of genreSeeds) {
      const created = await tx.genre.create({
        data: {
          slug: genre.slug,
          name: genre.name,
          isActive: true,
          imageUrl: makeImageUrl(genre.imageText),
        },
      });
      genreIds[genre.key] = created.id;
    }

    const userIds = {} as Record<UserKey, string>;
    for (const user of userSeeds) {
      const created = await tx.user.create({
        data: {
          name: user.name,
          email: user.email,
          password: passwordHash,
          avatar: makeAvatarUrl(user.avatarText),
          phone: user.phone,
          address: user.address,
          role: user.role,
          isVerified: true,
          isActive: true,
        },
      });

      userIds[user.key] = created.id;

      if (user.sellerProfile) {
        await tx.sellerProfile.create({
          data: {
            userId: created.id,
            storeName: user.sellerProfile.storeName,
            storeDescription: user.sellerProfile.storeDescription,
            bankAccount: user.sellerProfile.bankAccount,
            taxId: user.sellerProfile.taxId,
            isApproved: user.sellerProfile.isApproved,
          },
        });
      }
    }

    const productIds = {} as Record<ProductKey, string>;
    for (const product of productSeeds) {
      const created = await tx.product.create({
        data: {
          name: product.name,
          description: product.description,
          price: money(product.price),
          type: ProductType.DIGITAL,
          releaseDate: product.releaseDate,
          developer: product.developer,
          imageUrl: makeImageUrl(product.imageText),
          status: product.status,
          specPreset: product.specPreset,
          discountPercent: product.discountPercent,
          discountEndDate: product.discountEndDate ?? undefined,
          displayOrder: product.displayOrder,
          sellerId: userIds[product.sellerKey],
          platformId: platformIds[product.platformKey],
          genreId: genreIds[product.genreKey],
        },
      });

      productIds[product.key] = created.id;

      const requirementRows = [
        ...product.requirements.MINIMUM.map((req) => ({
          productId: created.id,
          type: RequirementType.MINIMUM,
          key: req.key,
          value: req.value,
        })),
        ...product.requirements.RECOMMENDED.map((req) => ({
          productId: created.id,
          type: RequirementType.RECOMMENDED,
          key: req.key,
          value: req.value,
        })),
      ];

      await tx.productRequirement.createMany({ data: requirementRows });
    }

    const buyerKeys: BuyerKey[] = ['buyerMain', 'buyerTwo', 'buyerThree'];
    const cartIds = {} as Record<BuyerKey, string>;
    const wishlistIds = {} as Record<BuyerKey, string>;

    for (const buyerKey of buyerKeys) {
      const cart = await tx.cart.create({ data: { userId: userIds[buyerKey] } });
      const wishlist = await tx.wishlist.create({ data: { userId: userIds[buyerKey] } });
      cartIds[buyerKey] = cart.id;
      wishlistIds[buyerKey] = wishlist.id;
    }

    await tx.cartItem.createMany({
      data: [
        { cartId: cartIds.buyerMain, productId: productIds.titanCircuit2099, quantity: 1 },
        { cartId: cartIds.buyerTwo, productId: productIds.pocketColony, quantity: 1 },
        { cartId: cartIds.buyerThree, productId: productIds.astralColony, quantity: 1 },
      ],
    });

    await tx.wishlistItem.createMany({
      data: [
        { wishlistId: wishlistIds.buyerMain, productId: productIds.pocketColony, addedAt: daysAgo(4) },
        { wishlistId: wishlistIds.buyerMain, productId: productIds.astralColony, addedAt: daysAgo(4) },
        { wishlistId: wishlistIds.buyerTwo, productId: productIds.titanCircuit2099, addedAt: daysAgo(6) },
        { wishlistId: wishlistIds.buyerTwo, productId: productIds.neonHarbor, addedAt: daysAgo(6) },
        { wishlistId: wishlistIds.buyerThree, productId: productIds.pocketColony, addedAt: daysAgo(3) },
      ],
    });

    const orderIds = {} as Record<OrderKey, string>;
    for (const orderSeed of orderSeeds) {
      const orderItemRows = orderSeed.items.map((item) => ({
        productId: productIds[item.productKey],
        quantity: item.quantity,
        unitPriceAtPurchase: money(productPriceByKey[item.productKey]),
      }));

      const created = await tx.order.create({
        data: {
          userId: userIds[orderSeed.userKey],
          paymentMethod: orderSeed.paymentMethod,
          externalId: orderSeed.externalId ?? undefined,
          shippingPrice: money(0),
          status: orderSeed.status,
          isPaid: orderSeed.isPaid,
          paidAt: orderSeed.paidAt ?? undefined,
          isDelivered: orderSeed.isDelivered,
          deliveredAt: orderSeed.deliveredAt ?? undefined,
        },
      });

      orderIds[orderSeed.key] = created.id;

      await tx.orderItem.createMany({
        data: orderItemRows.map((item) => ({
          orderId: created.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPriceAtPurchase: item.unitPriceAtPurchase,
        })),
      });

      if (orderSeed.payment) {
        await tx.payment.create({
          data: {
            orderId: created.id,
            mpPaymentId: orderSeed.payment.mpPaymentId,
            mpStatus: orderSeed.payment.mpStatus,
            mpPaymentType: orderSeed.payment.mpPaymentType,
            mpEmail: orderSeed.payment.mpEmail,
            createdAt: orderSeed.paidAt ?? orderSeed.createdAt,
          },
        });
      }

      if (orderSeed.transaction) {
        const total = calculateOrderTotal(orderSeed.items, productPriceByKey);
        const sellerKey = productSeedByKey[orderSeed.items[0].productKey].sellerKey;

        await tx.transaction.create({
          data: {
            orderId: created.id,
            sellerId: userIds[sellerKey],
            amount: money(total),
            status: orderSeed.transaction.status,
            approvedBy: orderSeed.transaction.approvedByKey
              ? userIds[orderSeed.transaction.approvedByKey]
              : undefined,
            approvedAt: orderSeed.transaction.approvedAt,
            createdAt: orderSeed.paidAt ?? orderSeed.createdAt,
          },
        });
      }
    }

    await tx.digitalKey.createMany({
      data: [
        ...Array.from({ length: productSeedByKey.chronoVanguard.keyCount }, (_, index) => ({
          productId: productIds.chronoVanguard,
          key: makeKey(productSeedByKey.chronoVanguard.keyPrefix, index + 1),
          status: KeyStatus.AVAILABLE,
          isActive: true,
        })),
        ...Array.from({ length: productSeedByKey.skylineTactics.keyCount }, (_, index) => ({
          productId: productIds.skylineTactics,
          key: makeKey(productSeedByKey.skylineTactics.keyPrefix, index + 1),
          status: KeyStatus.AVAILABLE,
          isActive: true,
        })),
        ...Array.from({ length: productSeedByKey.neonHarbor.keyCount }, (_, index) => ({
          productId: productIds.neonHarbor,
          key: makeKey(productSeedByKey.neonHarbor.keyPrefix, index + 1),
          status: KeyStatus.AVAILABLE,
          isActive: true,
        })),
        ...Array.from({ length: productSeedByKey.silentDepths.keyCount }, (_, index) => ({
          productId: productIds.silentDepths,
          key: makeKey(productSeedByKey.silentDepths.keyPrefix, index + 1),
          status: KeyStatus.AVAILABLE,
          isActive: true,
        })),
        ...Array.from({ length: productSeedByKey.titanCircuit2099.keyCount }, (_, index) => ({
          productId: productIds.titanCircuit2099,
          key: makeKey(productSeedByKey.titanCircuit2099.keyPrefix, index + 1),
          status: KeyStatus.AVAILABLE,
          isActive: true,
        })),
        ...Array.from({ length: productSeedByKey.astralColony.keyCount }, (_, index) => ({
          productId: productIds.astralColony,
          key: makeKey(productSeedByKey.astralColony.keyPrefix, index + 1),
          status: KeyStatus.AVAILABLE,
          isActive: true,
        })),
      ],
    });

    await tx.digitalKey.updateMany({
      where: {
        key: {
          in: [makeKey('CVG', 1)],
        },
      },
      data: {
        status: KeyStatus.SOLD,
        orderId: orderIds.orderOne,
        soldAt: orderSeeds[0].paidAt ?? undefined,
      },
    });

    await tx.digitalKey.updateMany({
      where: {
        key: {
          in: [makeKey('SKY', 1)],
        },
      },
      data: {
        status: KeyStatus.SOLD,
        orderId: orderIds.orderOne,
        soldAt: orderSeeds[0].paidAt ?? undefined,
      },
    });

    await tx.digitalKey.updateMany({
      where: {
        key: {
          in: [makeKey('CVG', 2)],
        },
      },
      data: {
        status: KeyStatus.SOLD,
        orderId: orderIds.orderTwo,
        soldAt: orderSeeds[1].paidAt ?? undefined,
      },
    });

    await tx.digitalKey.updateMany({
      where: {
        key: {
          in: [makeKey('SID', 1)],
        },
      },
      data: {
        status: KeyStatus.SOLD,
        orderId: orderIds.orderThree,
        soldAt: orderSeeds[2].paidAt ?? undefined,
      },
    });

    await tx.digitalKey.updateMany({
      where: {
        key: {
          in: [makeKey('AST', 1)],
        },
      },
      data: {
        status: KeyStatus.RESERVED,
        orderId: orderIds.orderFour,
      },
    });

    const reviewIds: string[] = [];
    for (const reviewSeed of reviewSeeds) {
      const created = await tx.review.create({
        data: {
          userId: userIds[reviewSeed.userKey],
          productId: productIds[reviewSeed.productKey],
          rating: reviewSeed.rating,
          title: reviewSeed.title,
          text: reviewSeed.text,
          verified: true,
          isActive: true,
          createdAt: reviewSeed.createdAt,
        },
      });
      reviewIds.push(created.id);
    }

    const helpfulVoteRows = reviewSeeds.flatMap((reviewSeed, index) =>
      reviewSeed.helpfulBy.map((userKey) => ({
        reviewId: reviewIds[index],
        userId: userIds[userKey],
      })),
    );

    await tx.reviewHelpfulVote.createMany({ data: helpfulVoteRows });
    },
    {
      timeout: 120000,
      maxWait: 20000,
    },
  );

  console.log('[OK] Base limpiada y seed aplicado con datos realistas.');
  console.log('Credenciales de prueba:');
  console.log('- buyer@4fun.test / password123');
  console.log('- buyer2@4fun.test / password123');
  console.log('- buyer3@4fun.test / password123');
  console.log('- seller@4fun.test / password123');
  console.log('- seller2@4fun.test / password123');
  console.log('- admin@4fun.test / password123');
  console.log(
    '[Resumen] users=6, platforms=5, genres=7, products=8, orders=5, reviews=4, keys=19',
  );
}

main()
  .catch((error) => {
    console.error('[ERROR] Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
