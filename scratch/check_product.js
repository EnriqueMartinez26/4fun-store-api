const prisma = require('../lib/prisma');

async function check() {
    try {
        const product = await prisma.product.findFirst({
            where: { status: 'DRAFT' }
        });
        console.log(JSON.stringify(product, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
