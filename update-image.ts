import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const targetId = 'c730f9d3-069c-404b-a667-b569399b85ac';
  const imageUrl = 'https://res.cloudinary.com/dxlbwdqop/image/upload/v1777937351/fzs0nlhbqbzwkryhee8c.jpg';

  try {
    const res = await prisma.product.update({
      where: { id: targetId },
      data: { imageUrl }
    });
    console.log(`✅ Producto [${res.name}] actualizado con éxito.`);
  } catch (e) {
    console.error('❌ Error:', e instanceof Error ? e.message : e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
