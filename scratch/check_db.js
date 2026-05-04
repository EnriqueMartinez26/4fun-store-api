const prisma = require('../lib/prisma');

async function main() {
  const genres = await prisma.genre.findMany();
  console.log('Genres in DB:', JSON.stringify(genres, null, 2));
  const products = await prisma.product.findMany();
  console.log('Total Products:', products.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
