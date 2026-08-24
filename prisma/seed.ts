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
type AdminKey = 'admin' | 'ownerAdmin';
type UserKey = BuyerKey | SellerKey | AdminKey;

type PlatformKey = 'steam' | 'gog' | 'xbox' | 'switch';
type GenreKey =
  | 'action'
  | 'adventure'
  | 'rpg'
  | 'strategy'
  | 'horror'
  | 'racing'
  | 'indie'
  | 'simulation';
type ProductKey =
  | 'eldenRing'
  | 'civilizationVi'
  | 'cyberpunk2077'
  | 'residentEvil4'
  | 'forzaHorizon5'
  | 'stardewValley'
  | 'hollowKnight'
  | 'doomEternal'
  | 'baldursGate3'
  | 'theWitcher3'
  | 'redDeadRedemption2'
  | 'sekiro'
  | 'darkSouls3'
  | 'discoElysium'
  | 'divinityOriginalSin2'
  | 'hades'
  | 'celeste'
  | 'deadCells'
  | 'slayTheSpire'
  | 'outerWilds'
  | 'subnautica'
  | 'portal2'
  | 'halfLifeAlyx'
  | 'alanWake2'
  | 'silentHill2'
  | 'godOfWarRagnarok'
  | 'oriWillOfTheWisps'
  | 'forzaMotorsport'
  | 'ageOfEmpiresIv'
  | 'totalWarWarhammer3';
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
};

type GenreSeed = {
  key: GenreKey;
  slug: string;
  name: string;
};

type UserSeed = {
  key: UserKey;
  name: string;
  email: string;
  role: Role;
  phone: string;
  address: string;
  /**
   * RN - Seguridad: variable de entorno de la que sale la contrasena de esta
   * cuenta. Se usa para cuentas reales, cuyo secreto nunca debe versionarse.
   * Sin este campo, la cuenta recibe la contrasena compartida de demostracion.
   */
  passwordEnvVar?: string;
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

// RN - Identidad Visual: portadas propias alojadas en Cloudinary, nombradas por la
// clave del producto. Arte original generado para el catalogo; no reproduce material
// de terceros.
const makeCoverUrl = (key: ProductKey) =>
  `${CDN}/covers/${key}.png`;

const CDN = 'https://res.cloudinary.com/dxlbwdqop/image/upload/4fun';

const makePlatformUrl = (key: PlatformKey) => `${CDN}/platform-${key}.png`;
const makeGenreUrl = (key: GenreKey) => `${CDN}/genre-${key}.png`;
const makeAvatarUrl = (key: UserKey) => `${CDN}/avatar-${key}.png`;

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
  { key: 'steam', slug: 'steam', name: 'Steam' },
  { key: 'gog', slug: 'gog-com', name: 'GOG.COM' },
  { key: 'xbox', slug: 'xbox-series-xs', name: 'Xbox Series X|S' },
  { key: 'switch', slug: 'nintendo-switch', name: 'Nintendo Switch' },
];

const genreSeeds: GenreSeed[] = [
  { key: 'action', slug: 'action', name: 'Action' },
  { key: 'adventure', slug: 'adventure', name: 'Adventure' },
  { key: 'rpg', slug: 'rpg', name: 'RPG' },
  { key: 'strategy', slug: 'strategy', name: 'Strategy' },
  { key: 'horror', slug: 'horror', name: 'Horror' },
  { key: 'racing', slug: 'racing', name: 'Racing' },
  { key: 'indie', slug: 'indie', name: 'Indie' },
  { key: 'simulation', slug: 'simulation', name: 'Simulation' },
];

const userSeeds: UserSeed[] = [
  {
    key: 'buyerMain',
    name: 'Lucía Fernández',
    email: 'buyer@4fun.test',
    role: Role.BUYER,
    phone: '+54 11 5555-0101',
    address: 'Sarmiento 1450, C1041 CABA, Argentina',
  },
  {
    key: 'buyerTwo',
    name: 'Tomás Acosta',
    email: 'buyer2@4fun.test',
    role: Role.BUYER,
    phone: '+54 341 555-0202',
    address: 'Bv. Oroño 1122, Rosario, Santa Fe, Argentina',
  },
  {
    key: 'buyerThree',
    name: 'Camila Torres',
    email: 'buyer3@4fun.test',
    role: Role.BUYER,
    phone: '+54 221 555-0303',
    address: 'Diagonal 74 2215, La Plata, Buenos Aires, Argentina',
  },
  {
    key: 'sellerMain',
    name: 'Marcos Ferreyra',
    email: 'seller@4fun.test',
    role: Role.SELLER,
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
    phone: '+54 11 5555-0606',
    address: 'Av. Belgrano 3200, C1093 CABA, Argentina',
  },
  {
    key: 'ownerAdmin',
    name: 'Enrique Leonel Martinez',
    email: 'emartinez.03@hotmail.com',
    role: Role.ADMIN,
    phone: '+54 381 6094007',
    address: 'San Miguel de Tucuman, Argentina',
    passwordEnvVar: 'OWNER_ADMIN_PASSWORD',
  },
];

const productSeeds: ProductSeed[] = [
  {
    key: 'eldenRing',
    name: 'Elden Ring',
    description:
      'Mundo abierto de fantasia oscura con exploracion libre y combate exigente.',
    price: '64999.00',
    releaseDate: new Date('2022-02-25T00:00:00Z'),
    developer: 'FromSoftware',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 1,
    sellerKey: 'sellerMain',
    platformKey: 'steam',
    genreKey: 'rpg',
    requirements: pcHighRequirements,
    keyPrefix: 'CVG',
    keyCount: 4,
  },
  {
    key: 'civilizationVi',
    name: 'Sid Meier’s Civilization VI',
    description:
      'Estrategia por turnos: fundar una civilizacion y llevarla de la antiguedad al futuro.',
    price: '32999.00',
    releaseDate: new Date('2016-10-21T00:00:00Z'),
    developer: 'Firaxis Games',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.LOW,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 2,
    sellerKey: 'sellerMain',
    platformKey: 'steam',
    genreKey: 'strategy',
    requirements: pcLowRequirements,
    keyPrefix: 'SKY',
    keyCount: 3,
  },
  {
    key: 'cyberpunk2077',
    name: 'Cyberpunk 2077',
    description:
      'Accion y rol en primera persona en una metropolis futurista de mercenarios.',
    price: '42999.00',
    releaseDate: new Date('2020-12-10T00:00:00Z'),
    developer: 'CD Projekt Red',
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
    key: 'residentEvil4',
    name: 'Resident Evil 4',
    description:
      'Reimaginacion del clasico de terror y supervivencia con combate sobre el hombro.',
    price: '53999.00',
    releaseDate: new Date('2023-03-24T00:00:00Z'),
    developer: 'Capcom',
    status: ProductStatus.OUT_OF_STOCK,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 4,
    sellerKey: 'sellerTwo',
    platformKey: 'gog',
    genreKey: 'horror',
    requirements: pcHighRequirements,
    keyPrefix: 'SID',
    keyCount: 1,
  },
  {
    key: 'forzaHorizon5',
    name: 'Forza Horizon 5',
    description:
      'Festival de carreras en mundo abierto ambientado en Mexico.',
    price: '47999.00',
    releaseDate: new Date('2021-11-09T00:00:00Z'),
    developer: 'Playground Games',
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
    key: 'stardewValley',
    name: 'Stardew Valley',
    description:
      'Simulador de granja y vida rural con cultivos, mineria y vinculos con el pueblo.',
    price: '15999.00',
    releaseDate: new Date('2016-02-26T00:00:00Z'),
    developer: 'ConcernedApe',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.LOW,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 6,
    sellerKey: 'sellerTwo',
    platformKey: 'switch',
    genreKey: 'simulation',
    requirements: switchRequirements,
    keyPrefix: 'AST',
    keyCount: 3,
  },
  {
    key: 'hollowKnight',
    name: 'Hollow Knight',
    description:
      'Metroidvania dibujado a mano en un reino subterraneo de insectos.',
    price: '15999.00',
    releaseDate: new Date('2017-02-24T00:00:00Z'),
    developer: 'Team Cherry',
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
    key: 'doomEternal',
    name: 'DOOM Eternal',
    description:
      'Shooter frenetico de ritmo alto contra hordas demoniacas.',
    price: '42999.00',
    releaseDate: new Date('2020-03-20T00:00:00Z'),
    developer: 'id Software',
    status: ProductStatus.SUSPENDED,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 8,
    sellerKey: 'sellerTwo',
    platformKey: 'steam',
    genreKey: 'action',
    requirements: pcHighRequirements,
    keyPrefix: 'IRN',
    keyCount: 0,
  },
  {
    key: 'baldursGate3',
    name: 'Baldur’s Gate 3',
    description:
      'Rol por turnos con reglas de mesa, decisiones ramificadas y companeros propios.',
    price: '64999.00',
    releaseDate: new Date('2023-08-03T00:00:00Z'),
    developer: 'Larian Studios',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 9,
    sellerKey: 'sellerMain',
    platformKey: 'steam',
    genreKey: 'rpg',
    requirements: pcHighRequirements,
    keyPrefix: 'BG3',
    keyCount: 4,
  },
  {
    key: 'theWitcher3',
    name: 'The Witcher 3: Wild Hunt',
    description:
      'Rol de mundo abierto con contratos de caza de monstruos y una historia extensa.',
    price: '32999.00',
    releaseDate: new Date('2015-05-19T00:00:00Z'),
    developer: 'CD Projekt Red',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.MID,
    discountPercent: 20,
    discountEndDate: daysFromNow(21),
    displayOrder: 10,
    sellerKey: 'sellerMain',
    platformKey: 'steam',
    genreKey: 'rpg',
    requirements: pcMidRequirements,
    keyPrefix: 'TW3',
    keyCount: 4,
  },
  {
    key: 'redDeadRedemption2',
    name: 'Red Dead Redemption 2',
    description:
      'Aventura de mundo abierto en el ocaso del lejano oeste estadounidense.',
    price: '53999.00',
    releaseDate: new Date('2018-10-26T00:00:00Z'),
    developer: 'Rockstar Games',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 11,
    sellerKey: 'sellerMain',
    platformKey: 'steam',
    genreKey: 'adventure',
    requirements: pcHighRequirements,
    keyPrefix: 'RDR',
    keyCount: 3,
  },
  {
    key: 'sekiro',
    name: 'Sekiro: Shadows Die Twice',
    description:
      'Accion en el Japon del siglo XVI centrada en el duelo y la postura.',
    price: '53999.00',
    releaseDate: new Date('2019-03-22T00:00:00Z'),
    developer: 'FromSoftware',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 12,
    sellerKey: 'sellerTwo',
    platformKey: 'steam',
    genreKey: 'action',
    requirements: pcHighRequirements,
    keyPrefix: 'SEK',
    keyCount: 3,
  },
  {
    key: 'darkSouls3',
    name: 'Dark Souls III',
    description:
      'Rol de accion metodico en un mundo en decadencia interconectado.',
    price: '42999.00',
    releaseDate: new Date('2016-04-12T00:00:00Z'),
    developer: 'FromSoftware',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.MID,
    discountPercent: 15,
    discountEndDate: daysFromNow(21),
    displayOrder: 13,
    sellerKey: 'sellerTwo',
    platformKey: 'steam',
    genreKey: 'rpg',
    requirements: pcMidRequirements,
    keyPrefix: 'DS3',
    keyCount: 4,
  },
  {
    key: 'discoElysium',
    name: 'Disco Elysium',
    description:
      'Rol de investigacion sin combate, resuelto enteramente con dialogo y pensamiento.',
    price: '26999.00',
    releaseDate: new Date('2019-10-15T00:00:00Z'),
    developer: 'ZA/UM',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.LOW,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 14,
    sellerKey: 'sellerMain',
    platformKey: 'steam',
    genreKey: 'rpg',
    requirements: pcLowRequirements,
    keyPrefix: 'DSE',
    keyCount: 4,
  },
  {
    key: 'divinityOriginalSin2',
    name: 'Divinity: Original Sin 2',
    description:
      'Rol tactico por turnos con interaccion elemental y cooperativo completo.',
    price: '47999.00',
    releaseDate: new Date('2017-09-14T00:00:00Z'),
    developer: 'Larian Studios',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.MID,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 15,
    sellerKey: 'sellerMain',
    platformKey: 'steam',
    genreKey: 'rpg',
    requirements: pcMidRequirements,
    keyPrefix: 'DOS',
    keyCount: 3,
  },
  {
    key: 'hades',
    name: 'Hades',
    description:
      'Roguelite de accion isometrica donde cada intento avanza el relato.',
    price: '26999.00',
    releaseDate: new Date('2020-09-17T00:00:00Z'),
    developer: 'Supergiant Games',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.LOW,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 16,
    sellerKey: 'sellerTwo',
    platformKey: 'steam',
    genreKey: 'action',
    requirements: pcLowRequirements,
    keyPrefix: 'HDS',
    keyCount: 5,
  },
  {
    key: 'celeste',
    name: 'Celeste',
    description:
      'Plataformas de precision sobre una montana, con una historia intima detras.',
    price: '21999.00',
    releaseDate: new Date('2018-01-25T00:00:00Z'),
    developer: 'Maddy Makes Games',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.LOW,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 17,
    sellerKey: 'sellerMain',
    platformKey: 'switch',
    genreKey: 'indie',
    requirements: switchRequirements,
    keyPrefix: 'CLS',
    keyCount: 5,
  },
  {
    key: 'deadCells',
    name: 'Dead Cells',
    description:
      'Roguevania de combate rapido y progresion permanente entre corridas.',
    price: '26999.00',
    releaseDate: new Date('2018-08-07T00:00:00Z'),
    developer: 'Motion Twin',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.LOW,
    discountPercent: 10,
    discountEndDate: daysFromNow(21),
    displayOrder: 18,
    sellerKey: 'sellerTwo',
    platformKey: 'switch',
    genreKey: 'action',
    requirements: switchRequirements,
    keyPrefix: 'DCL',
    keyCount: 4,
  },
  {
    key: 'slayTheSpire',
    name: 'Slay the Spire',
    description:
      'Constructor de mazos por turnos con ascensiones y partidas irrepetibles.',
    price: '26999.00',
    releaseDate: new Date('2019-01-23T00:00:00Z'),
    developer: 'Mega Crit Games',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.LOW,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 19,
    sellerKey: 'sellerMain',
    platformKey: 'switch',
    genreKey: 'strategy',
    requirements: switchRequirements,
    keyPrefix: 'STS',
    keyCount: 5,
  },
  {
    key: 'outerWilds',
    name: 'Outer Wilds',
    description:
      'Exploracion espacial en un sistema solar atrapado en un bucle de 22 minutos.',
    price: '26999.00',
    releaseDate: new Date('2019-05-28T00:00:00Z'),
    developer: 'Mobius Digital',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.MID,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 20,
    sellerKey: 'sellerMain',
    platformKey: 'steam',
    genreKey: 'adventure',
    requirements: pcMidRequirements,
    keyPrefix: 'OWL',
    keyCount: 3,
  },
  {
    key: 'subnautica',
    name: 'Subnautica',
    description:
      'Supervivencia y exploracion submarina en un planeta oceanico desconocido.',
    price: '32999.00',
    releaseDate: new Date('2018-01-23T00:00:00Z'),
    developer: 'Unknown Worlds',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.MID,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 21,
    sellerKey: 'sellerTwo',
    platformKey: 'steam',
    genreKey: 'simulation',
    requirements: pcMidRequirements,
    keyPrefix: 'SBN',
    keyCount: 4,
  },
  {
    key: 'portal2',
    name: 'Portal 2',
    description:
      'Rompecabezas en primera persona con portales, humor seco y modo cooperativo.',
    price: '10999.00',
    releaseDate: new Date('2011-04-19T00:00:00Z'),
    developer: 'Valve',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.LOW,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 22,
    sellerKey: 'sellerMain',
    platformKey: 'steam',
    genreKey: 'adventure',
    requirements: pcLowRequirements,
    keyPrefix: 'PRT',
    keyCount: 5,
  },
  {
    key: 'halfLifeAlyx',
    name: 'Half-Life: Alyx',
    description:
      'Accion en realidad virtual ambientada entre los dos primeros Half-Life.',
    price: '53999.00',
    releaseDate: new Date('2020-03-23T00:00:00Z'),
    developer: 'Valve',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 23,
    sellerKey: 'sellerTwo',
    platformKey: 'steam',
    genreKey: 'action',
    requirements: pcHighRequirements,
    keyPrefix: 'HLA',
    keyCount: 3,
  },
  {
    key: 'alanWake2',
    name: 'Alan Wake 2',
    description:
      'Terror narrativo de dos protagonistas entre un pueblo real y un mundo escrito.',
    price: '53999.00',
    releaseDate: new Date('2023-10-27T00:00:00Z'),
    developer: 'Remedy Entertainment',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 24,
    sellerKey: 'sellerTwo',
    platformKey: 'steam',
    genreKey: 'horror',
    requirements: pcHighRequirements,
    keyPrefix: 'AW2',
    keyCount: 3,
  },
  {
    key: 'silentHill2',
    name: 'Silent Hill 2',
    description:
      'Terror psicologico en un pueblo cubierto de niebla que responde a la culpa.',
    price: '74999.00',
    releaseDate: new Date('2024-10-08T00:00:00Z'),
    developer: 'Bloober Team',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.HIGH,
    discountPercent: 25,
    discountEndDate: daysFromNow(21),
    displayOrder: 25,
    sellerKey: 'sellerTwo',
    platformKey: 'gog',
    genreKey: 'horror',
    requirements: pcHighRequirements,
    keyPrefix: 'SH2',
    keyCount: 3,
  },
  {
    key: 'godOfWarRagnarok',
    name: 'God of War Ragnarok',
    description:
      'Accion y aventura por los nueve reinos nordicos, padre e hijo.',
    price: '64999.00',
    releaseDate: new Date('2022-11-09T00:00:00Z'),
    developer: 'Santa Monica Studio',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 26,
    sellerKey: 'sellerMain',
    platformKey: 'gog',
    genreKey: 'action',
    requirements: pcHighRequirements,
    keyPrefix: 'GWR',
    keyCount: 4,
  },
  {
    key: 'oriWillOfTheWisps',
    name: 'Ori and the Will of the Wisps',
    description:
      'Plataformas pintado a mano con combate fluido y banda sonora orquestal.',
    price: '32999.00',
    releaseDate: new Date('2020-03-11T00:00:00Z'),
    developer: 'Moon Studios',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.MID,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 27,
    sellerKey: 'sellerMain',
    platformKey: 'xbox',
    genreKey: 'adventure',
    requirements: xboxRequirements,
    keyPrefix: 'ORI',
    keyCount: 4,
  },
  {
    key: 'forzaMotorsport',
    name: 'Forza Motorsport',
    description:
      'Simulador de circuitos con desgaste de neumaticos y clima dinamico.',
    price: '58999.00',
    releaseDate: new Date('2023-10-10T00:00:00Z'),
    developer: 'Turn 10 Studios',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 28,
    sellerKey: 'sellerTwo',
    platformKey: 'xbox',
    genreKey: 'racing',
    requirements: xboxRequirements,
    keyPrefix: 'FZM',
    keyCount: 3,
  },
  {
    key: 'ageOfEmpiresIv',
    name: 'Age of Empires IV',
    description:
      'Estrategia en tiempo real con ocho civilizaciones y campanas historicas.',
    price: '42999.00',
    releaseDate: new Date('2021-10-28T00:00:00Z'),
    developer: 'Relic Entertainment',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.MID,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 29,
    sellerKey: 'sellerMain',
    platformKey: 'steam',
    genreKey: 'strategy',
    requirements: pcMidRequirements,
    keyPrefix: 'AE4',
    keyCount: 3,
  },
  {
    key: 'totalWarWarhammer3',
    name: 'Total War: WARHAMMER III',
    description:
      'Estrategia por turnos y batallas masivas en tiempo real en un mundo de fantasia.',
    price: '53999.00',
    releaseDate: new Date('2022-02-17T00:00:00Z'),
    developer: 'Creative Assembly',
    status: ProductStatus.ACTIVE,
    specPreset: SpecPreset.HIGH,
    discountPercent: 0,
    discountEndDate: null,
    displayOrder: 30,
    sellerKey: 'sellerTwo',
    platformKey: 'steam',
    genreKey: 'strategy',
    requirements: pcHighRequirements,
    keyPrefix: 'TWW',
    keyCount: 3,
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
      { productKey: 'eldenRing', quantity: 1 },
      { productKey: 'civilizationVi', quantity: 1 },
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
    items: [{ productKey: 'eldenRing', quantity: 1 }],
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
    items: [{ productKey: 'residentEvil4', quantity: 1 }],
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
    items: [{ productKey: 'stardewValley', quantity: 1 }],
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
    items: [{ productKey: 'forzaHorizon5', quantity: 1 }],
  },
];

const reviewSeeds: ReviewSeed[] = [
  {
    productKey: 'eldenRing',
    userKey: 'buyerMain',
    rating: 5,
    title: 'Táctico, exigente y muy sólido',
    text: 'Excelente ritmo, combate muy limpio y una presentación visual que sostiene la campaña completa.',
    createdAt: daysAgo(13),
    helpfulBy: ['buyerTwo', 'buyerThree'],
  },
  {
    productKey: 'civilizationVi',
    userKey: 'buyerMain',
    rating: 4,
    title: 'Ideal para partidas cortas',
    text: 'Muy buen diseño de misiones y una curva de dificultad bastante honesta para su tamaño.',
    createdAt: daysAgo(12),
    helpfulBy: ['buyerTwo'],
  },
  {
    productKey: 'eldenRing',
    userKey: 'buyerTwo',
    rating: 4,
    title: 'Buen ritmo y mucha identidad',
    text: 'La historia engancha y el sistema táctico tiene suficiente profundidad para volver a jugarlo.',
    createdAt: daysAgo(2),
    helpfulBy: ['buyerMain', 'buyerThree'],
  },
  {
    productKey: 'residentEvil4',
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

  // RN - Seguridad: las cuentas reales toman su secreto del entorno. Si falta,
  // el seed se detiene en vez de crear un administrador con una clave debil.
  const passwordHashByUser = new Map<UserKey, string>();
  for (const user of userSeeds) {
    if (!user.passwordEnvVar) continue;
    const secret = process.env[user.passwordEnvVar];
    if (!secret || secret.length < 12) {
      throw new Error(
        `${user.passwordEnvVar} es obligatoria y debe tener al menos 12 caracteres ` +
          `para crear la cuenta ${user.email}.`,
      );
    }
    passwordHashByUser.set(user.key, await bcrypt.hash(secret, 10));
  }

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
          imageUrl: makePlatformUrl(platform.key),
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
          imageUrl: makeGenreUrl(genre.key),
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
          password: passwordHashByUser.get(user.key) ?? passwordHash,
          avatar: makeAvatarUrl(user.key),
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
          imageUrl: makeCoverUrl(product.key),
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
        { cartId: cartIds.buyerMain, productId: productIds.forzaHorizon5, quantity: 1 },
        { cartId: cartIds.buyerTwo, productId: productIds.hollowKnight, quantity: 1 },
        { cartId: cartIds.buyerThree, productId: productIds.stardewValley, quantity: 1 },
      ],
    });

    await tx.wishlistItem.createMany({
      data: [
        { wishlistId: wishlistIds.buyerMain, productId: productIds.hollowKnight, addedAt: daysAgo(4) },
        { wishlistId: wishlistIds.buyerMain, productId: productIds.stardewValley, addedAt: daysAgo(4) },
        { wishlistId: wishlistIds.buyerTwo, productId: productIds.forzaHorizon5, addedAt: daysAgo(6) },
        { wishlistId: wishlistIds.buyerTwo, productId: productIds.cyberpunk2077, addedAt: daysAgo(6) },
        { wishlistId: wishlistIds.buyerThree, productId: productIds.hollowKnight, addedAt: daysAgo(3) },
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

    // RN - Mantenibilidad: las claves se derivan de productSeeds, de modo que
    // todo producto nuevo recibe su lote sin tocar esta sección.
    await tx.digitalKey.createMany({
      data: productSeeds.flatMap((product) =>
        Array.from({ length: product.keyCount }, (_, index) => ({
          productId: productIds[product.key],
          key: makeKey(product.keyPrefix, index + 1),
          status: KeyStatus.AVAILABLE,
          isActive: true,
        })),
      ),
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
    `[Resumen] users=${userSeeds.length}, platforms=${platformSeeds.length}, ` +
      `genres=${genreSeeds.length}, products=${productSeeds.length}, ` +
      `orders=${orderSeeds.length}, reviews=${reviewSeeds.length}, ` +
      `keys=${productSeeds.reduce((sum, p) => sum + p.keyCount, 0)}`,
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
