
const prisma = require('../lib/prisma');

async function forceActivate() {
    const productId = 'a2ce0fb4-5f61-456d-a6fd-afe24ccb39e1';
    const product = await prisma.product.update({
        where: { id: productId },
        data: { status: 'ACTIVE' }
    });
    console.log('PRODUCTO ACTIVADO MANUALMENTE:', product.name, 'Estado:', product.status);
}

forceActivate()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
