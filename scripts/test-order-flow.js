const http = require('http');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

const BASE_HOST = 'localhost';
const BASE_PORT = 9003;

const BUYER = {
  email: 'buyer@4fun.test',
  password: 'password123',
};

const PRODUCT_NAMES = {
  space: 'Space Rift Digital',
  pixel: 'Pixel Quest Digital',
  noKeys: 'No Keys Demo',
};

function request({ method, path, body, cookie }) {
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const headers = {};

    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    if (cookie) {
      headers.Cookie = cookie;
    }

    const req = http.request(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path,
        method,
        headers,
      },
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          let json = null;

          try {
            json = data ? JSON.parse(data) : null;
          } catch {
            return reject(new Error(`Respuesta no JSON en ${method} ${path}: ${data}`));
          }

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            rawBody: data,
            body: json,
          });
        });
      }
    );

    req.on('error', reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractCookie(setCookieHeader) {
  assert(Array.isArray(setCookieHeader), '[ERROR] Login no devolvió Set-Cookie.');
  const tokenCookie = setCookieHeader.find((cookie) => cookie.startsWith('token='));
  assert(tokenCookie, '[ERROR] No se encontró cookie token.');
  return tokenCookie.split(';')[0];
}

async function getProductByName(name) {
  const product = await prisma.product.findFirst({
    where: { name },
  });
  assert(product, `[ERROR] No se encontró producto: ${name}.`);
  return product;
}

async function cleanBuyerCart() {
  const buyer = await prisma.user.findUnique({
    where: { email: BUYER.email },
  });

  if (!buyer) return;

  await prisma.cartItem.deleteMany({
    where: {
      cart: {
        userId: buyer.id,
      },
    },
  });

  await prisma.cart.deleteMany({
    where: {
      userId: buyer.id,
    },
  });
}

async function cleanBuyerOrdersForFreshRun() {
  const buyer = await prisma.user.findUnique({
    where: { email: BUYER.email },
  });

  if (!buyer) return;

  await prisma.order.deleteMany({
    where: {
      userId: buyer.id,
    },
  });
}

async function main() {
  console.log('[INFO] Iniciando validación de Generación de Orden (Paso 5).');

  console.log('[INFO] Limpiando datos previos del comprador.');
  await cleanBuyerCart();
  await cleanBuyerOrdersForFreshRun();

  const space = await getProductByName(PRODUCT_NAMES.space);
  const pixel = await getProductByName(PRODUCT_NAMES.pixel);
  const noKeys = await getProductByName(PRODUCT_NAMES.noKeys);

  console.log('[INFO] Iniciando login del comprador.');
  const login = await request({
    method: 'POST',
    path: '/api/auth/login',
    body: BUYER,
  });

  assert(login.statusCode === 200, `Login fallido con status ${login.statusCode}`);
  const cookie = extractCookie(login.headers['set-cookie']);

  console.log('[OK] Login comprador validado.');

  // 1. Agregar ítems al carrito (simulando preparación)
  console.log('[INFO] Agregando Space Rift Digital x2 al carrito.');
  const addSpace = await request({
    method: 'POST',
    path: '/api/cart',
    cookie,
    body: { productId: space.id, quantity: 2 },
  });
  assert(addSpace.statusCode === 200, `Error al agregar Space: ${addSpace.statusCode}`);

  console.log('[INFO] Agregando Pixel Quest Digital x1 al carrito.');
  const addPixel = await request({
    method: 'POST',
    path: '/api/cart',
    cookie,
    body: { productId: pixel.id, quantity: 1 },
  });
  assert(addPixel.statusCode === 200, `Error al agregar Pixel: ${addPixel.statusCode}`);

  // 2. Generar Orden de Compra (Checkout)
  console.log('[INFO] Iniciando checkout (Generando Orden).');
  const checkoutPayload = {
    paymentMethod: 'MERCADOPAGO',
    shippingAddress: {
      fullName: 'Comprador Test',
      street: 'Calle Falsa 123',
      city: 'Tucumán',
      state: 'Tucumán',
      zip: '4000',
      country: 'Argentina',
    },
    orderItems: [
      { product: space.id, quantity: 2, name: space.name },
      { product: pixel.id, quantity: 1, name: pixel.name },
    ],
  };

  const checkoutRes = await request({
    method: 'POST',
    path: '/api/orders',
    cookie,
    body: checkoutPayload,
  });

  assert(checkoutRes.statusCode === 201, `Checkout fallido con status ${checkoutRes.statusCode}`);
  assert(checkoutRes.body?.success === true, '[ERROR] Checkout no devolvió success=true.');
  assert(checkoutRes.body?.orderId, '[ERROR] Checkout no devolvió orderId.');
  assert(checkoutRes.body?.paymentLink, '[ERROR] Checkout no devolvió paymentLink.');

  const createdOrderId = checkoutRes.body.orderId;
  console.log(`[OK] Orden creada con ID: ${createdOrderId}`);

  // 3. Validar estado de la orden en Base de Datos
  console.log('[INFO] Consultando orden en base de datos...');
  const orderInDb = await prisma.order.findUnique({
    where: { id: createdOrderId },
    include: { orderItems: true },
  });

  assert(orderInDb, '[ERROR] La orden no existe en base de datos.');
  assert(orderInDb.status === 'PENDING', `[ERROR] Estado de orden esperado PENDING, obtenido: ${orderInDb.status}`);
  assert(orderInDb.isPaid === false, '[ERROR] La orden no debe estar pagada.');
  
  const expectedTotal = 59.99 * 2 + 29.99;
  const dbTotal = Number(orderInDb.totalPrice);
  assert(Math.abs(dbTotal - expectedTotal) < 0.01, `[ERROR] Precio total esperado $${expectedTotal}, obtenido $${dbTotal}`);

  // Validación de items individuales
  assert(orderInDb.orderItems.length === 2, `[ERROR] La orden debía tener 2 items, tiene ${orderInDb.orderItems.length}.`);

  const spaceOrderItem = orderInDb.orderItems.find((item) => item.product === space.id || item.productId === space.id);
  const pixelOrderItem = orderInDb.orderItems.find((item) => item.product === pixel.id || item.productId === pixel.id);

  assert(spaceOrderItem, '[ERROR] La orden no contiene Space Rift Digital.');
  assert(pixelOrderItem, '[ERROR] La orden no contiene Pixel Quest Digital.');

  assert(spaceOrderItem.quantity === 2, `[ERROR] Space debía quedar quantity=2, quedó ${spaceOrderItem.quantity}.`);
  assert(pixelOrderItem.quantity === 1, `[ERROR] Pixel debía quedar quantity=1, quedó ${pixelOrderItem.quantity}.`);

  // Validar precios unitarios consolidados desde BD
  const spacePriceDb = Number(spaceOrderItem.unitPriceAtPurchase);
  const pixelPriceDb = Number(pixelOrderItem.unitPriceAtPurchase);
  assert(Math.abs(spacePriceDb - 59.99) < 0.01, `[ERROR] Precio unitario Space esperado $59.99, obtenido $${spacePriceDb}`);
  assert(Math.abs(pixelPriceDb - 29.99) < 0.01, `[ERROR] Precio unitario Pixel esperado $29.99, obtenido $${pixelPriceDb}`);

  console.log('[OK] Estado de orden, ítems y monto total validados en base de datos.');

  // 4. Validar que no se consuman ni asignen keys
  console.log('[INFO] Validando que las claves no hayan sido consumidas o asignadas.');
  const assignedKeys = await prisma.digitalKey.count({
    where: { orderId: createdOrderId },
  });
  assert(assignedKeys === 0, `[ERROR] No deben asignarse claves en esta etapa. Encontradas: ${assignedKeys}`);

  const spaceKeysAvailable = await prisma.digitalKey.count({
    where: { productId: space.id, status: 'AVAILABLE' },
  });
  assert(spaceKeysAvailable === 3, `[ERROR] Las llaves disponibles de Space Rift Digital deben seguir siendo 3. Obtenidas: ${spaceKeysAvailable}`);

  console.log('[OK] La generación de orden no consumió ni asignó claves.');

  // 5. Validar que no se generen transacciones de escrow
  console.log('[INFO] Validando que no se hayan generado transacciones de escrow.');
  const transactionCount = await prisma.transaction.count({
    where: { orderId: createdOrderId },
  });
  assert(transactionCount === 0, `[ERROR] No debe crearse transacción de escrow en esta etapa. Encontradas: ${transactionCount}`);

  console.log('[OK] Ausencia de transacciones validada.');

  // 6. Simular vaciado de carrito post-checkout (landing en success)
  console.log('[INFO] Simulando vaciado de carrito (DELETE /api/cart).');
  const clearCartRes = await request({
    method: 'DELETE',
    path: '/api/cart',
    cookie,
  });
  assert(clearCartRes.statusCode === 200, `Fallo al limpiar carrito: ${clearCartRes.statusCode}`);

  const cartCheck = await request({
    method: 'GET',
    path: '/api/cart',
    cookie,
  });
  const cartItems = cartCheck.body?.cart?.items || [];
  assert(cartItems.length === 0, `[ERROR] El carrito debía estar vacío, tiene ${cartItems.length} items.`);

  console.log('[OK] Vaciado de carrito validado.');

  // 7. Intentar generar orden superando stock
  console.log('[INFO] Intentando checkout con cantidad que supera stock (Pixel Quest x2).');
  const overstockPayload = {
    paymentMethod: 'MERCADOPAGO',
    shippingAddress: checkoutPayload.shippingAddress,
    orderItems: [
      { product: pixel.id, quantity: 2, name: pixel.name },
    ],
  };

  const overstockRes = await request({
    method: 'POST',
    path: '/api/orders',
    cookie,
    body: overstockPayload,
  });

  assert([400, 409].includes(overstockRes.statusCode), `[ERROR] Checkout con sobrestock debió fallar. Código: ${overstockRes.statusCode}`);
  console.log('[OK] Bloqueo de orden con sobrestock validado.');

  // 8. Intentar generar orden con producto agotado (No Keys Demo)
  console.log('[INFO] Intentando checkout con producto agotado (No Keys Demo).');
  const outOfStockPayload = {
    paymentMethod: 'MERCADOPAGO',
    shippingAddress: checkoutPayload.shippingAddress,
    orderItems: [
      { product: noKeys.id, quantity: 1, name: noKeys.name },
    ],
  };

  const outOfStockRes = await request({
    method: 'POST',
    path: '/api/orders',
    cookie,
    body: outOfStockPayload,
  });

  assert([400, 409].includes(outOfStockRes.statusCode), `[ERROR] Checkout con producto agotado debió fallar. Código: ${outOfStockRes.statusCode}`);
  console.log('[OK] Bloqueo de orden con producto agotado validado.');

  // 9. Intentar generar orden con producto inactivo (DRAFT)
  console.log('[INFO] Intentando checkout con producto inactivo (DRAFT).');
  
  // Cambiar Pixel temporalmente a DRAFT en base de datos
  await prisma.product.update({
    where: { id: pixel.id },
    data: { status: 'DRAFT' },
  });

  const inactivePayload = {
    paymentMethod: 'MERCADOPAGO',
    shippingAddress: checkoutPayload.shippingAddress,
    orderItems: [
      { product: pixel.id, quantity: 1, name: pixel.name },
    ],
  };

  const inactiveRes = await request({
    method: 'POST',
    path: '/api/orders',
    cookie,
    body: inactivePayload,
  });

  // Restaurar el producto a ACTIVE
  await prisma.product.update({
    where: { id: pixel.id },
    data: { status: 'ACTIVE' },
  });

  assert(inactiveRes.statusCode === 400, `[ERROR] Checkout con producto inactivo debió retornar 400. Código: ${inactiveRes.statusCode}`);
  console.log('[OK] Bloqueo de orden con producto inactivo (DRAFT) validado.');

  // Guardar referencia de orden para el Paso 6 al final de las llamadas HTTP
  const outputPath = path.join(__dirname, 'm2-last-order.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        orderId: createdOrderId,
        buyerEmail: BUYER.email,
        status: orderInDb.status,
        isPaid: orderInDb.isPaid,
        totalPrice: Number(orderInDb.totalPrice),
        paymentMethod: 'MERCADOPAGO',
        products: [
          { name: PRODUCT_NAMES.space, quantity: 2 },
          { name: PRODUCT_NAMES.pixel, quantity: 1 },
        ],
      },
      null,
      2
    )
  );
  console.log(`[OK] Orden disponible para Paso 6. Referencia guardada en ${outputPath}`);

  console.log('[INFO] Realizando limpieza final de base de datos.');
  await cleanBuyerCart(); // Solo limpiamos carrito, conservando la orden creada para Paso 6.

  console.log('[OK] Validación de Generación de Orden finalizada correctamente.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[ERROR] Validación fallida.');
    console.error(err.message);
    try {
      await cleanBuyerCart();
      await cleanBuyerOrdersForFreshRun();
    } finally {
      await prisma.$disconnect();
      process.exit(1);
    }
  });
