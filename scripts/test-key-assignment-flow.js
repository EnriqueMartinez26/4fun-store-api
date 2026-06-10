const fs = require('fs');
const path = require('path');
const http = require('http');
const prisma = require('../lib/prisma');

const BASE_HOST = 'localhost';
const BASE_PORT = 9003;

const ADMIN_USER = {
  email: 'admin@4fun.test',
  password: 'password123',
};

const BUYER_USER = {
  email: 'buyer@4fun.test',
  password: 'password123',
};

const PAID_ORDER_FILE = path.join(__dirname, 'm2-paid-order.json');
const OUTPUT_FILE = path.join(__dirname, 'm2-assigned-keys.json');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  assert(fs.existsSync(filePath), `[ERROR] No existe el archivo requerido: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function request({ method, route, body, cookie }) {
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
        path: route,
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
            return reject(new Error(`Respuesta no JSON en ${method} ${route}: ${data}`));
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

    if (payload) req.write(payload);
    req.end();
  });
}

async function login(user) {
  const response = await request({
    method: 'POST',
    route: '/api/auth/login',
    body: user,
  });

  assert(response.statusCode === 200, `[ERROR] Login fallido para ${user.email}. Status: ${response.statusCode}`);
  assert(response.body?.success === true, `[ERROR] Login sin success=true para ${user.email}.`);

  const setCookie = response.headers['set-cookie'];
  assert(Array.isArray(setCookie) && setCookie.length > 0, `[ERROR] Login de ${user.email} no devolvió Set-Cookie.`);

  const tokenCookie = setCookie.find((cookie) => cookie.startsWith('token='));
  assert(tokenCookie, `[ERROR] Login de ${user.email} no devolvió cookie token.`);

  assert(tokenCookie.toLowerCase().includes('httponly'), `[ERROR] Cookie token de ${user.email} no es HttpOnly.`);

  return tokenCookie.split(';')[0];
}

function keyPreview(key) {
  if (!key || typeof key !== 'string') return '<REDACTED>';
  if (key.length <= 8) return '<REDACTED>';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

async function getOrderSnapshot(orderId) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      orderItems: {
        include: {
          product: true,
        },
      },
      digitalKeys: {
        include: {
          product: true,
        },
      },
      transaction: true,
    },
  });
}

function groupAssignedKeysByProduct(order) {
  const result = {};

  for (const item of order.orderItems) {
    result[item.product.name] = {
      productId: item.productId,
      quantity: item.quantity,
      keys: order.digitalKeys.filter((key) => key.productId === item.productId),
    };
  }

  return result;
}

async function validateInitialOrder(orderId) {
  const order = await getOrderSnapshot(orderId);

  assert(order, `[ERROR] La orden ${orderId} no existe.`);
  assert(order.isPaid === true, '[ERROR] La orden debe estar pagada antes de asignar keys.');
  assert(order.paidAt, '[ERROR] La orden pagada debe tener paidAt.');
  assert(order.status === 'PENDING', `[ERROR] Estado comercial inesperado antes de asignar keys: ${order.status}.`);
  assert(order.digitalKeys.length === 0, `[ERROR] La orden ya tiene ${order.digitalKeys.length} keys asignadas antes del Paso 7.`);
  assert(!order.transaction, '[ERROR] La orden ya tiene Transaction antes del Paso 7.');

  const items = order.orderItems.map((item) => ({
    name: item.product.name,
    quantity: item.quantity,
  }));

  const space = items.find((item) => item.name === 'Space Rift Digital');
  const pixel = items.find((item) => item.name === 'Pixel Quest Digital');

  assert(space?.quantity === 2, '[ERROR] Space Rift Digital debe tener quantity=2.');
  assert(pixel?.quantity === 1, '[ERROR] Pixel Quest Digital debe tener quantity=1.');

  console.log('[OK] Orden inicial validada: pagada, PENDING, sin keys y sin transacciones.');

  return order;
}

async function validateAvailability(order) {
  for (const item of order.orderItems) {
    const available = await prisma.digitalKey.count({
      where: {
        productId: item.productId,
        status: 'AVAILABLE',
        orderId: null,
        isActive: true,
      },
    });

    assert(
      available >= item.quantity,
      `[ERROR] Stock insuficiente para ${item.product.name}. Requiere ${item.quantity}, disponible ${available}.`
    );
  }

  const noKeysDemo = await prisma.product.findFirst({
    where: { name: 'No Keys Demo' },
  });

  if (noKeysDemo) {
    const noKeysAvailable = await prisma.digitalKey.count({
      where: {
        productId: noKeysDemo.id,
        status: 'AVAILABLE',
        orderId: null,
        isActive: true,
      },
    });

    assert(noKeysAvailable === 0, `[ERROR] No Keys Demo debería tener 0 keys AVAILABLE, tiene ${noKeysAvailable}.`);
  }

  console.log('[OK] Disponibilidad suficiente validada por producto.');
}

function validateAssignedKeys(order) {
  assert(order.digitalKeys.length === 3, `[ERROR] Se esperaban 3 keys asignadas, hay ${order.digitalKeys.length}.`);

  const keyIds = order.digitalKeys.map((key) => key.id);
  const uniqueKeyIds = new Set(keyIds);

  assert(uniqueKeyIds.size === keyIds.length, '[ERROR] Hay keys duplicadas asociadas a la orden.');

  const grouped = groupAssignedKeysByProduct(order);

  assert(grouped['Space Rift Digital']?.keys.length === 2, '[ERROR] Space Rift Digital debe tener exactamente 2 keys.');
  assert(grouped['Pixel Quest Digital']?.keys.length === 1, '[ERROR] Pixel Quest Digital debe tener exactly 1 key.');

  for (const key of order.digitalKeys) {
    assert(key.orderId === order.id, '[ERROR] Una key asignada no apunta a la orden correcta.');
    assert(key.status !== 'AVAILABLE', '[ERROR] Una key asignada sigue AVAILABLE.');
    assert(key.status === 'SOLD' || key.status === 'RESERVED', `[ERROR] Estado de key inesperado: ${key.status}.`);
  }

  console.log('[OK] Se asignaron exactamente 3 keys digitales.');
  console.log('[OK] Space Rift Digital recibió 2 keys.');
  console.log('[OK] Pixel Quest Digital recibió 1 key.');
  console.log('[OK] Todas las keys asignadas son únicas y dejaron de estar AVAILABLE.');
}

async function validateNoEscrow(orderId) {
  const transactionCount = await prisma.transaction.count({
    where: { orderId },
  });

  assert(transactionCount === 0, `[ERROR] Paso 7 no debe crear Transaction. Encontradas: ${transactionCount}.`);

  console.log('[OK] No se crearon transacciones escrow.');
}

async function validateNoKeysDemoParticipation(orderId) {
  const noKeysDemo = await prisma.product.findFirst({
    where: { name: 'No Keys Demo' },
  });

  if (!noKeysDemo) {
    console.log('[INFO] No Keys Demo no existe en esta base. Se omite validación específica.');
    return;
  }

  const assignedToNoKeysDemo = await prisma.digitalKey.count({
    where: {
      productId: noKeysDemo.id,
      orderId,
    },
  });

  assert(assignedToNoKeysDemo === 0, `[ERROR] No Keys Demo recibió ${assignedToNoKeysDemo} keys.`);

  console.log('[OK] No Keys Demo no recibió keys.');
}

async function validateBuyerCannotAssign(orderId, buyerCookie) {
  const response = await request({
    method: 'POST',
    route: `/api/orders/${orderId}/assign-keys`,
    cookie: buyerCookie,
  });

  assert(
    response.statusCode === 401 || response.statusCode === 403,
    `[ERROR] El comprador no debería poder asignar keys. Status recibido: ${response.statusCode}.`
  );

  console.log('[OK] Comprador bloqueado para asignar keys.');
}

async function validateDoubleAssignment(orderId, adminCookie, previousKeyIds) {
  const response = await request({
    method: 'POST',
    route: `/api/orders/${orderId}/assign-keys`,
    cookie: adminCookie,
  });

  assert(
    response.statusCode === 200 || response.statusCode === 201 || response.statusCode === 400 || response.statusCode === 409,
    `[ERROR] Doble asignación devolvió status inesperado: ${response.statusCode}.`
  );

  const orderAfterSecondAttempt = await getOrderSnapshot(orderId);
  const currentKeyIds = orderAfterSecondAttempt.digitalKeys.map((key) => key.id).sort();
  const expectedKeyIds = [...previousKeyIds].sort();

  assert(currentKeyIds.length === 3, `[ERROR] Doble asignación dejó ${currentKeyIds.length} keys. Deben seguir siendo 3.`);
  assert(
    JSON.stringify(currentKeyIds) === JSON.stringify(expectedKeyIds),
    '[ERROR] Doble asignación modificó o reemplazó keys asignadas.'
  );

  await validateNoEscrow(orderId);

  console.log('[OK] Doble asignación no duplicó ni reemplazó keys.');
}

async function validateUnpaidOrderRejection(adminCookie, buyerId, productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  assert(product, '[ERROR] No se encontró producto para crear orden negativa no pagada.');

  const unpaidOrder = await prisma.order.create({
    data: {
      userId: buyerId,
      paymentMethod: 'MERCADOPAGO',
      shippingPrice: 0,
      totalPrice: product.price,
      status: 'PENDING',
      isPaid: false,
      orderItems: {
        create: [
          {
            productId: product.id,
            quantity: 1,
            unitPriceAtPurchase: product.price,
          },
        ],
      },
    },
    include: {
      digitalKeys: true,
      transaction: true,
    },
  });

  try {
    const response = await request({
      method: 'POST',
      route: `/api/orders/${unpaidOrder.id}/assign-keys`,
      cookie: adminCookie,
    });

    assert(
      response.statusCode === 400 || response.statusCode === 403 || response.statusCode === 409,
      `[ERROR] Orden no pagada debería rechazar asignación. Status: ${response.statusCode}.`
    );

    const assignedKeys = await prisma.digitalKey.count({
      where: { orderId: unpaidOrder.id },
    });

    const transactionCount = await prisma.transaction.count({
      where: { orderId: unpaidOrder.id },
    });

    assert(assignedKeys === 0, '[ERROR] Se asignaron keys a una orden no pagada.');
    assert(transactionCount === 0, '[ERROR] Se creó Transaction para una orden no pagada.');

    console.log('[OK] Orden no pagada rechazada correctamente.');
  } finally {
    await prisma.order.delete({
      where: { id: unpaidOrder.id },
    });

    console.log('[OK] Limpieza de orden negativa no pagada completada.');
  }
}

function buildOutput(order) {
  const grouped = groupAssignedKeysByProduct(order);

  return {
    orderId: order.id,
    buyerEmail: order.user.email,
    status: order.status,
    isPaid: order.isPaid,
    totalAssignedKeys: order.digitalKeys.length,
    products: Object.entries(grouped).map(([name, data]) => ({
      name,
      quantity: data.quantity,
      assignedKeys: data.keys.map((key) => ({
        id: key.id,
        status: key.status,
        keyPreview: keyPreview(key.key),
      })),
    })),
    transactionCreated: Boolean(order.transaction),
  };
}

async function main() {
  console.log('[INFO] Iniciando validación de Asignación de Key Digital (Paso 7).');

  const paidOrderRef = readJson(PAID_ORDER_FILE);
  const orderId = paidOrderRef.orderId;

  assert(orderId, '[ERROR] m2-paid-order.json no contiene orderId.');

  console.log(`[INFO] Orden de entrada para Paso 7: ${orderId}.`);

  const initialOrder = await validateInitialOrder(orderId);
  await validateAvailability(initialOrder);

  console.log('[INFO] Iniciando login admin.');
  const adminCookie = await login(ADMIN_USER);
  console.log('[OK] Login admin validado con cookie HttpOnly.');

  console.log('[INFO] Iniciando login comprador.');
  const buyerCookie = await login(BUYER_USER);
  console.log('[OK] Login comprador validado con cookie HttpOnly.');

  await validateBuyerCannotAssign(orderId, buyerCookie);

  console.log('[INFO] Ejecutando asignación de keys digitales.');
  const assignResponse = await request({
    method: 'POST',
    route: `/api/orders/${orderId}/assign-keys`,
    cookie: adminCookie,
  });

  assert(
    assignResponse.statusCode === 200 || assignResponse.statusCode === 201,
    `[ERROR] Endpoint de asignación falló. Status: ${assignResponse.statusCode}. Body: ${JSON.stringify(assignResponse.body)}`
  );

  console.log('[OK] Endpoint de asignación ejecutado correctamente.');

  const assignedOrder = await getOrderSnapshot(orderId);

  validateAssignedKeys(assignedOrder);
  await validateNoKeysDemoParticipation(orderId);
  await validateNoEscrow(orderId);

  const assignedKeyIds = assignedOrder.digitalKeys.map((key) => key.id);

  console.log('[INFO] Validando doble asignación como idempotente o error controlado.');
  await validateDoubleAssignment(orderId, adminCookie, assignedKeyIds);

  console.log('[INFO] Validando rechazo para orden no pagada.');
  await validateUnpaidOrderRejection(
    adminCookie,
    assignedOrder.userId,
    assignedOrder.orderItems[0].productId
  );

  const finalOrder = await getOrderSnapshot(orderId);
  const output = buildOutput(finalOrder);

  assert(output.transactionCreated === false, '[ERROR] m2-assigned-keys.json no debe indicar transactionCreated=true.');

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');

  console.log(`[OK] Referencia de keys asignadas guardada en ${OUTPUT_FILE}.`);
  console.log('[OK] Validación de Asignación de Key Digital finalizada correctamente.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[ERROR] Validación de Asignación de Key Digital fallida.');
    console.error(error.message);

    await prisma.$disconnect();
    process.exit(1);
  });
