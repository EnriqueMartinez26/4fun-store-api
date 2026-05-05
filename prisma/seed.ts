import { PrismaClient, Role, ProductType, PaymentMethod, OrderStatus, ProductStatus, SpecPreset } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const saltRounds = 10;
  const commonPassword = await bcrypt.hash('admin123', saltRounds);

  console.log('👤 Asegurando usuario administrador...');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@4fun.com' },
    update: { password: commonPassword },
    create: {
      email: 'admin@4fun.com',
      password: commonPassword,
      name: 'Administrador 4Fun',
      role: Role.ADMIN,
      isVerified: true,
      sellerProfile: {
        create: {
          storeName: '4Fun Store Oficial',
          storeDescription: 'Distribuidor oficial de las mejores franquicias de videojuegos.',
          isApproved: true,
        }
      }
    },
  });

  console.log('🎮 Asegurando taxonomías (Plataformas y Géneros)...');
  
  const platformsData = [
    { name: 'PC', slug: 'pc' },
    { name: 'PlayStation 5', slug: 'ps5' },
    { name: 'Xbox Series X', slug: 'xbox-sx' },
    { name: 'Nintendo Switch', slug: 'switch' },
  ];

  const platforms = await Promise.all(
    platformsData.map(p => 
      prisma.platform.upsert({
        where: { slug: p.slug },
        update: {},
        create: p
      })
    )
  );

  const genresData = [
    { name: 'Acción', slug: 'accion' },
    { name: 'Aventura', slug: 'aventura' },
    { name: 'RPG', slug: 'rpg' },
    { name: 'Deportes', slug: 'deportes' },
    { name: 'Mundo Abierto', slug: 'mundo-abierto' },
    { name: 'Lucha', slug: 'lucha' },
  ];

  const genres = await Promise.all(
    genresData.map(g => 
      prisma.genre.upsert({
        where: { slug: g.slug },
        update: {},
        create: g
      })
    )
  );

  const p_pc = platforms.find(p => p.slug === 'pc')?.id!;
  const p_ps5 = platforms.find(p => p.slug === 'ps5')?.id!;
  const p_xbox = platforms.find(p => p.slug === 'xbox-sx')?.id!;
  const p_switch = platforms.find(p => p.slug === 'switch')?.id!;

  const g_accion = genres.find(g => g.slug === 'accion')?.id!;
  const g_aventura = genres.find(g => g.slug === 'aventura')?.id!;
  const g_rpg = genres.find(g => g.slug === 'rpg')?.id!;
  const g_deportes = genres.find(g => g.slug === 'deportes')?.id!;
  const g_open = genres.find(g => g.slug === 'mundo-abierto')?.id!;
  const g_lucha = genres.find(g => g.slug === 'lucha')?.id!;

  console.log('📦 Verificando/Poblando catálogo con 15 productos estrella...');

  const productsData = [
    {
      name: 'Grand Theft Auto V',
      description: 'Experimenta las vidas entrelazadas de tres criminales muy diferentes en el mundo abierto más grande jamás creado.',
      price: 45000,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2013-09-17'),
      developer: 'Rockstar North',
      imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/271590/header.jpg',
      stock: 500,
      status: ProductStatus.ACTIVE,
      platformId: p_pc,
      genreId: g_open,
      sellerId: admin.id,
    },
    {
      name: 'Super Smash Bros. Ultimate',
      description: '¡Lucha con los personajes más icónicos de los videojuegos en el crossover definitivo!',
      price: 85000,
      type: ProductType.PHYSICAL,
      releaseDate: new Date('2018-12-07'),
      developer: 'Nintendo',
      imageUrl: 'https://assets.nintendo.com/image/upload/ar_16:9,c_lpad,w_1240/b_white/f_auto/q_auto/v1/ncom/en_US/games/switch/s/super-smash-bros-ultimate-switch/hero',
      stock: 25,
      status: ProductStatus.ACTIVE,
      platformId: p_switch,
      genreId: g_lucha,
      sellerId: admin.id,
    },
    {
      name: 'Red Dead Redemption 2',
      description: 'Una epopeya de forajidos ambientada en el ocaso del Salvaje Oeste.',
      price: 65000,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2018-10-26'),
      developer: 'Rockstar Games',
      imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1174180/header.jpg',
      stock: 150,
      status: ProductStatus.ACTIVE,
      platformId: p_pc,
      genreId: g_open,
      sellerId: admin.id,
    },
    {
      name: 'The Legend of Zelda: Breath of the Wild',
      description: 'Olvida todo lo que sabes sobre los juegos de The Legend of Zelda.',
      price: 72000,
      type: ProductType.PHYSICAL,
      releaseDate: new Date('2017-03-03'),
      developer: 'Nintendo',
      imageUrl: 'https://assets.nintendo.com/image/upload/ar_16:9,c_lpad,w_1240/b_white/f_auto/q_auto/v1/ncom/en_US/games/switch/t/the-legend-of-zelda-breath-of-the-wild-switch/hero',
      stock: 12,
      status: ProductStatus.ACTIVE,
      platformId: p_switch,
      genreId: g_aventura,
      sellerId: admin.id,
    },
    {
      name: 'Elden Ring',
      description: 'Álzate, Sinluz, y déjate guiar por la Gracia para esgrimir el poder del Círculo de Elden.',
      price: 78000,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2022-02-25'),
      developer: 'FromSoftware',
      imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg',
      stock: 300,
      status: ProductStatus.ACTIVE,
      platformId: p_ps5,
      genreId: g_rpg,
      sellerId: admin.id,
    },
    {
      name: 'EA SPORTS FC 24',
      description: 'La nueva era de The World\'s Game te ofrece la experiencia futbolística más fiel.',
      price: 55000,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2023-09-29'),
      developer: 'EA Sports',
      imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/2140330/header.jpg',
      stock: 1000,
      status: ProductStatus.ACTIVE,
      platformId: p_xbox,
      genreId: g_deportes,
      sellerId: admin.id,
    },
    {
      name: 'Cyberpunk 2077',
      description: 'Una historia de acción y aventura de mundo abierto ambientada en Night City.',
      price: 48000,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2020-12-10'),
      developer: 'CD PROJEKT RED',
      imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg',
      stock: 200,
      status: ProductStatus.ACTIVE,
      platformId: p_pc,
      genreId: g_rpg,
      sellerId: admin.id,
    },
    {
      name: 'Mario Kart 8 Deluxe',
      description: '¡Disfruta de la versión definitiva de Mario Kart 8 donde quieras y cuando quieras!',
      price: 68000,
      type: ProductType.PHYSICAL,
      releaseDate: new Date('2017-04-28'),
      developer: 'Nintendo',
      imageUrl: 'https://assets.nintendo.com/image/upload/ar_16:9,c_lpad,w_1240/b_white/f_auto/q_auto/v1/ncom/en_US/games/switch/m/mario-kart-8-deluxe-switch/hero',
      stock: 40,
      status: ProductStatus.ACTIVE,
      platformId: p_switch,
      genreId: g_deportes,
      sellerId: admin.id,
    },
    {
      name: 'Spider-Man 2',
      description: 'Los Spider-Men Peter Parker y Miles Morales regresan para una nueva y emocionante aventura.',
      price: 82000,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2023-10-20'),
      developer: 'Insomniac Games',
      imageUrl: 'https://image.api.playstation.com/vulcan/ap/rnd/202306/1219/1c7b7534d8c351f77d34177d.png',
      stock: 150,
      status: ProductStatus.ACTIVE,
      platformId: p_ps5,
      genreId: g_accion,
      sellerId: admin.id,
    },
    {
      name: 'God of War Ragnarök',
      description: 'Kratos y Atreus deben viajar a cada uno de los nueve reinos en busca de respuestas.',
      price: 79000,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2022-11-09'),
      developer: 'Santa Monica Studio',
      imageUrl: 'https://image.api.playstation.com/vulcan/ap/rnd/202207/1210/4Eps9sRncjjg9S58vImj0z96.png',
      stock: 200,
      status: ProductStatus.ACTIVE,
      platformId: p_ps5,
      genreId: g_accion,
      sellerId: admin.id,
    },
    {
      name: 'Resident Evil 4 Remake',
      description: 'La supervivencia es solo el principio. Un clásico renovado.',
      price: 52000,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2023-03-24'),
      developer: 'Capcom',
      imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/2050650/header.jpg',
      stock: 100,
      status: ProductStatus.ACTIVE,
      platformId: p_pc,
      genreId: g_accion,
      sellerId: admin.id,
    },
    {
      name: 'Minecraft',
      description: 'Explora mundos infinitos y construye cualquier cosa que imagines.',
      price: 18000,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2011-11-18'),
      developer: 'Mojang Studios',
      imageUrl: 'https://www.minecraft.net/content/dam/games/minecraft/key-art/Minecraft-Vanilla-KeyArt-16x9.jpg',
      stock: 5000,
      status: ProductStatus.ACTIVE,
      platformId: p_pc,
      genreId: g_aventura,
      sellerId: admin.id,
    },
    {
      name: 'Stardew Valley',
      description: 'Heredaste la vieja granja de tu abuelo en Stardew Valley.',
      price: 1200,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2016-02-26'),
      developer: 'ConcernedApe',
      imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg',
      stock: 1000,
      status: ProductStatus.ACTIVE,
      platformId: p_pc,
      genreId: g_rpg,
      sellerId: admin.id,
    },
    {
      name: 'Grand Theft Auto IV',
      description: 'Niko Bellic, Johnny Klebitz y Luis Lopez tienen algo en común: viven en la peor ciudad de EE. UU.',
      price: 15000,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2008-04-29'),
      developer: 'Rockstar North',
      imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/12210/header.jpg',
      stock: 100,
      status: ProductStatus.ACTIVE,
      platformId: p_pc,
      genreId: g_open,
      sellerId: admin.id,
    },
    {
      name: 'Grand Theft Auto: San Andreas',
      description: 'Carl Johnson regresa a Los Santos para vengar la muerte de su madre.',
      price: 8000,
      type: ProductType.DIGITAL,
      releaseDate: new Date('2004-10-26'),
      developer: 'Rockstar North',
      imageUrl: 'https://placehold.co/600x400?text=GTA+San+Andreas',
      stock: 100,
      status: ProductStatus.ACTIVE,
      platformId: p_pc,
      genreId: g_open,
      sellerId: admin.id,
    }
  ];

  let createdCount = 0;
  for (const product of productsData) {
    const existing = await prisma.product.findFirst({
      where: {
        name: product.name,
        platformId: product.platformId
      }
    });

    if (!existing) {
      await prisma.product.create({ data: product });
      createdCount++;
    }
  }

  console.log(`✅ Proceso finalizado.`);
  console.log(`📦 Se crearon ${createdCount} nuevos productos.`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });