const prisma = require('../lib/prisma');

async function wipeCatalog() {
    try {
        console.log('--- Iniciando limpieza profunda del catálogo y transacciones ---');

        // El orden es CRÍTICO para no violar Constraints de FK
        await prisma.transaction.deleteMany();
        console.log('✅ Transacciones eliminadas');

        await prisma.orderItem.deleteMany();
        console.log('✅ Items de Órdenes eliminados');

        await prisma.order.deleteMany();
        console.log('✅ Órdenes eliminadas');

        await prisma.digitalKey.deleteMany();
        console.log('✅ DigitalKeys eliminadas');

        await prisma.reviewHelpfulVote.deleteMany();
        await prisma.review.deleteMany();
        console.log('✅ Reseñas y votos eliminados');

        await prisma.cartItem.deleteMany();
        console.log('✅ Carritos limpiados');

        await prisma.wishlistItem.deleteMany();
        console.log('✅ Wishlists limpiadas');

        await prisma.bundleItem.deleteMany();
        console.log('✅ Estructuras de Bundles eliminadas');

        await prisma.productRequirement.deleteMany();
        console.log('✅ Requerimientos técnicos eliminados');

        const deletedProducts = await prisma.product.deleteMany();
        console.log(`🚀 TOTAL PRODUCTOS ELIMINADOS: ${deletedProducts.count}`);

        console.log('--- Base de datos lista para nueva carga ---');
    } catch (error) {
        console.error('❌ Error durante la limpieza:', error);
    } finally {
        await prisma.$disconnect();
    }
}

wipeCatalog();
