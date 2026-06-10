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

const ADMIN = {
  email: 'admin@4fun.test',
  password: 'password123',
};

const LAST_ORDER_PATH = path.join(__dirname, 'm2-last-order.json');
const PAID_ORDER_PATH = path.join(__dirname, 'm2-paid-order.json');

const PAYMENT_ENDPOINT = {
  method: 'PUT',
  path: (orderId) => `/api/orders/${orderId}/pay`,
};

const PAYMENT_BODY = {};

const EXPECTED_STATUS_AFTER_PAYMENT = 'PENDING';

const PAYMENT_REQUIRES_ADMIN = true;

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

function isErrorStatus(statusCode) {
  return [400, 401, 403, 404, 409, 422].includes(statusCode);
}

function extractCookie(setCookieHeader, context) {
  assert(Array.isArray(setCookieHeader), `[ERROR] ${context} no devolvió Set-Cookie.`);
  const tokenCookie = setCookieHeader.find((cookie) => cookie.startsWith('token='));

  assert(tokenCookie, `[ERROR] ${context}: no se encontró cookie token.`);
  assert(tokenCookie.includes('HttpOnly'), `[ERROR] ${context}: cookie token no tiene HttpOnly.`);

  return tokenCookie.split(';')[0];
}

async function login(user, context) {
  const response = await request({
    method: 'POST',
    path: '/api/auth/login',
    body: user,
  });

  assert(response.statusCode === 200, `[ERROR] ${context}: login debía responder 200, respondió ${response.statusCode}.`);
  assert(response.body?.success === true, `[ERROR] ${context}: login no devolvió success=true.`);

  return extractCookie(response.headers['set-cookie'], context);
}

function loadLastOrder() {
  assert(fs.existsSync(LAST_ORDER_PATH), `[ERROR] No existe ${LAST_ORDER_PATH}. Ejecutá Paso 5 antes de Paso 6.`);

  const data = JSON.parse(fs.readFileSync(LAST_ORDER_PATH, 'utf8'));

  assert(data.orderId, '[ERROR] m2-last-order.json no contiene orderId.');
  assert(data.buyerEmail === BUYER.email, `[ERROR] buyerEmail inesperado en m2-last-order.json: ${data.buyerEmail}.`);

  return data;
}

async function getOrder(orderId) {
  const includeAttempts = [
    {
      orderItems: {
        include: {
          product: true,
        },
      },
    },
    {
      items: {
        include: {
          product: true,
        },
      },
    },
  ];

  for (const include of includeAttempts) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include,
      });

      if (order) return order;
    } catch {
      // Intentar siguiente relación.
    }
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  return order;
}

function getOrderItems(order) {
  if (Array.isArray(order?.orderItems)) return order.orderItems;
  if (Array.isArray(order?.items)) return order.items;
  return [];
}

function getProductNameFromOrderItem(item) {
  return item.product?.name || item.productName || item.name;
}

function getQuantityFromOrderItem(item) {
  return item.quantity ?? item.qty ?? item.amount;
}

function getTotal(order) {
  return Number(order.totalPrice ?? order.total ?? order.totalAmount ?? order.amount);
}

async function countKeysAssignedToOrder(orderId) {
  return prisma.digitalKey.count({
    where: { orderId },
  });
}

async function countUnavailableKeysForProducts(productNames) {
  const products = await prisma.product.findMany({
    where: {
      name: {
        in: productNames,
      },
    },
  });

  const productIds = products.map((product) => product.id);

  return prisma.digitalKey.count({
    where: {
      productId: {
        in: productIds,
      },
      status: {
        in: ['SOLD', 'RESERVED'],
      },
    },
  });
}

async function countTransactionsForOrder(orderId) {
  try {
    return await prisma.transaction.count({
      where: { orderId },
    });
  } catch {
    throw new Error('[ERROR] No se pudo contar Transaction por orderId. Revisar schema.prisma.');
  }
}

async function assertOrderStillHasExpectedItems(order, expectedProducts) {
  const items = getOrderItems(order);

  assert(items.length === expectedProducts.length, `[ERROR] La orden debía tener ${expectedProducts.length} items, tiene ${items.length}.`);

  for (const expected of expectedProducts) {
    const found = items.find((item) => getProductNameFromOrderItem(item) === expected.name);

    assert(found, `[ERROR] La orden perdió el item ${expected.name}.`);
    assert(
      getQuantityFromOrderItem(found) === expected.quantity,
      `[ERROR] ${expected.name} debía tener quantity=${expected.quantity}, tiene ${getQuantityFromOrderItem(found)}.`
    );
  }
}

async function callPaymentEndpoint(cookie, orderId) {
  return request({
    method: PAYMENT_ENDPOINT.method,
    path: PAYMENT_ENDPOINT.path(orderId),
    cookie,
    body: PAYMENT_BODY,
  });
}

async function main() {
  console.log('[INFO] Iniciando validación de Pago Simulado/Admin (Paso 6).');

  const lastOrder = loadLastOrder();
  const orderId = lastOrder.orderId;

  console.log(`[INFO] Orden de entrada para Paso 6: ${orderId}.`);

  const orderBeforePayment = await getOrder(orderId);

  assert(orderBeforePayment, `[ERROR] No existe la orden ${orderId}. No ejecutes seed antes de Paso 6.`);
  assert(orderBeforePayment.status === 'PENDING', `[ERROR] La orden debía iniciar PENDING, está ${orderBeforePayment.status}.`);
  assert(orderBeforePayment.isPaid === false, '[ERROR] La orden debía iniciar con isPaid=false.');
  assert(getTotal(orderBeforePayment) === Number(lastOrder.totalPrice), `[ERROR] Total inicial inconsistente. Esperado ${lastOrder.totalPrice}, obtenido ${getTotal(orderBeforePayment)}.`);

  await assertOrderStillHasExpectedItems(orderBeforePayment, lastOrder.products);

  const keysBefore = await countKeysAssignedToOrder(orderId);
  const unavailableKeysBefore = await countUnavailableKeysForProducts(lastOrder.products.map((product) => product.name));
  const transactionsBefore = await countTransactionsForOrder(orderId);

  assert(keysBefore === 0, `[ERROR] La orden ya tiene keys asignadas antes del pago: ${keysBefore}.`);
  assert(unavailableKeysBefore === 0, `[ERROR] Hay keys no disponibles antes del pago: ${unavailableKeysBefore}.`);
  assert(transactionsBefore === 0, `[ERROR] La orden ya tiene transacciones antes del pago: ${transactionsBefore}.`);

  console.log('[OK] Orden inicial validada: PENDING, no pagada, sin keys y sin transacciones.');

  console.log('[INFO] Iniciando login del comprador.');
  const buyerCookie = await login(BUYER, 'Buyer');

  if (PAYMENT_REQUIRES_ADMIN) {
    console.log('[INFO] Validando que el comprador no pueda marcar pago administrativo.');

    const buyerPaymentAttempt = await callPaymentEndpoint(buyerCookie, orderId);

    assert(
      [401, 403].includes(buyerPaymentAttempt.statusCode),
      `[ERROR] El comprador no debe poder marcar pago admin. Status recibido: ${buyerPaymentAttempt.statusCode}.`
    );

    const orderAfterBuyerAttempt = await getOrder(orderId);
    assert(orderAfterBuyerAttempt.isPaid === false, '[ERROR] El intento del comprador no debe marcar la orden como pagada.');

    console.log('[OK] Comprador bloqueado para marcar pago administrativo.');
  } else {
    console.log('[INFO] Validación buyer/admin omitida: modo de simulación sin endpoint administrativo.');
  }

  const paymentCookie = PAYMENT_REQUIRES_ADMIN
    ? await login(ADMIN, 'Admin')
    : buyerCookie;

  console.log('[INFO] Ejecutando pago simulado/admin sobre la orden.');
  const paymentResponse = await callPaymentEndpoint(paymentCookie, orderId);

  assert(
    [200, 201].includes(paymentResponse.statusCode),
    `[ERROR] Pago simulado/admin debía responder 200/201, respondió ${paymentResponse.statusCode}. Body: ${paymentResponse.rawBody}`
  );

  assert(paymentResponse.body?.success !== false, '[ERROR] Pago simulado/admin devolvió success=false.');

  console.log('[OK] Endpoint de pago simulado/admin ejecutado correctamente.');

  console.log('[INFO] Validando estado de la orden luego del pago.');
  const orderAfterPayment = await getOrder(orderId);

  assert(orderAfterPayment, `[ERROR] La orden ${orderId} desapareció luego del pago.`);
  assert(orderAfterPayment.isPaid === true, '[ERROR] La orden debe quedar con isPaid=true.');

  assert(
    orderAfterPayment.status === EXPECTED_STATUS_AFTER_PAYMENT,
    `[ERROR] Estado esperado luego del pago: ${EXPECTED_STATUS_AFTER_PAYMENT}. Estado obtenido: ${orderAfterPayment.status}.`
  );

  if ('paidAt' in orderAfterPayment) {
    assert(orderAfterPayment.paidAt, '[ERROR] paidAt existe en el modelo pero quedó vacío.');
  }

  assert(getTotal(orderAfterPayment) === Number(lastOrder.totalPrice), `[ERROR] El total cambió tras el pago. Esperado ${lastOrder.totalPrice}, obtenido ${getTotal(orderAfterPayment)}.`);

  await assertOrderStillHasExpectedItems(orderAfterPayment, lastOrder.products);

  console.log('[OK] Orden pagada validada: estado, isPaid, total e items conservados.');

  console.log('[INFO] Validando que Paso 6 no asigne keys digitales.');
  const keysAfter = await countKeysAssignedToOrder(orderId);
  const unavailableKeysAfter = await countUnavailableKeysForProducts(lastOrder.products.map((product) => product.name));

  assert(keysAfter === 0, `[ERROR] Paso 6 no debe asignar keys a la orden. Encontradas: ${keysAfter}.`);
  assert(unavailableKeysAfter === 0, `[ERROR] Paso 6 no debe cambiar keys a SOLD/RESERVED/ASSIGNED. Encontradas: ${unavailableKeysAfter}.`);

  console.log('[OK] Pago no asignó ni reservó keys digitales.');

  console.log('[INFO] Validando que Paso 6 no cree transacciones escrow.');
  const transactionsAfter = await countTransactionsForOrder(orderId);

  assert(transactionsAfter === 0, `[ERROR] Paso 6 no debe crear transacciones escrow. Encontradas: ${transactionsAfter}.`);

  console.log('[OK] Pago no creó transacciones escrow.');

  console.log('[INFO] Validando doble pago como operation idempotente o error controlado.');
  const secondPaymentResponse = await callPaymentEndpoint(paymentCookie, orderId);

  assert(
    [200, 201, 400, 409].includes(secondPaymentResponse.statusCode),
    `[ERROR] Segundo pago devolvió status inesperado: ${secondPaymentResponse.statusCode}.`
  );

  const orderAfterSecondPayment = await getOrder(orderId);
  const transactionsAfterSecondPayment = await countTransactionsForOrder(orderId);
  const keysAfterSecondPayment = await countKeysAssignedToOrder(orderId);

  assert(orderAfterSecondPayment.isPaid === true, '[ERROR] La orden debe seguir pagada tras segundo intento.');
  assert(orderAfterSecondPayment.status === EXPECTED_STATUS_AFTER_PAYMENT, `[ERROR] La orden cambió de estado tras segundo intento: ${orderAfterSecondPayment.status}.`);
  assert(transactionsAfterSecondPayment === 0, `[ERROR] Segundo pago creó transacciones: ${transactionsAfterSecondPayment}.`);
  assert(keysAfterSecondPayment === 0, `[ERROR] Segundo pago asignó keys: ${keysAfterSecondPayment}.`);

  console.log('[OK] Doble pago no produjo efectos indebidos.');

  const fakeOrderResponse = await callPaymentEndpoint(paymentCookie, '00000000-0000-0000-0000-000000000000');

  assert(
    isErrorStatus(fakeOrderResponse.statusCode),
    `[ERROR] Pago sobre orden inexistente debía devolver error controlado, respondió ${fakeOrderResponse.statusCode}.`
  );

  console.log('[OK] Pago sobre orden inexistente rechazado correctamente.');

  fs.writeFileSync(
    PAID_ORDER_PATH,
    JSON.stringify(
      {
        orderId,
        buyerEmail: lastOrder.buyerEmail,
        status: orderAfterPayment.status,
        isPaid: orderAfterPayment.isPaid,
        paidAt: orderAfterPayment.paidAt || null,
        totalPrice: getTotal(orderAfterPayment),
        paymentMethod: lastOrder.paymentMethod,
        paymentMode: PAYMENT_REQUIRES_ADMIN ? 'ADMIN_MARK_AS_PAID' : 'SIMULATED_PAYMENT',
        products: lastOrder.products,
      },
      null,
      2
    )
  );

  console.log(`[OK] Orden pagada disponible para Paso 7. Referencia guardada en ${PAID_ORDER_PATH}.`);
  console.log('[OK] Validación de Pago Simulado/Admin finalizada correctamente.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[ERROR] Validación de Pago Simulado/Admin fallida.');
    console.error(error.message);

    await prisma.$disconnect();
    process.exit(1);
  });
