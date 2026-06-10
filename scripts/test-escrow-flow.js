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

const ASSIGNED_KEYS_FILE = path.join(__dirname, 'm2-assigned-keys.json');
const OUTPUT_FILE = path.join(__dirname, 'm2-escrow-transaction.json');

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
      digitalKeys: true,
      transaction: true,
    },
  });
}

async function validateInitialOrder(orderId) {
  const order = await getOrderSnapshot(orderId);

  assert(order, `[ERROR] La orden ${orderId} no existe.`);
  assert(order.isPaid === true, '[ERROR] La orden debe estar pagada antes de crear escrow.');
  assert(order.paidAt, '[ERROR] La orden pagada debe tener paidAt.');
  assert(order.status === 'PENDING', `[ERROR] Estado comercial inesperado antes de crear escrow: ${order.status}.`);
  assert(order.digitalKeys.length === 3, `[ERROR] La orden debe tener exactamente 3 keys asignadas. Encontradas: ${order.digitalKeys.length}`);
  assert(!order.transaction, '[ERROR] La orden ya tiene Transaction antes del Paso 8.');

  console.log('[OK] Orden inicial validada: pagada, con 3 keys asignadas y sin transacción.');
  return order;
}

async function validateBuyerCannotCreateEscrow(orderId, buyerCookie) {
  const response = await request({
    method: 'POST',
    route: `/api/orders/${orderId}/escrow`,
    cookie: buyerCookie,
  });

  assert(
    response.statusCode === 401 || response.statusCode === 403,
    `[ERROR] El comprador no debería poder crear escrow. Status recibido: ${response.statusCode}.`
  );

  console.log('[OK] Comprador bloqueado para crear escrow.');
}

async function validateDoubleEscrow(orderId, adminCookie) {
  const response = await request({
    method: 'POST',
    route: `/api/orders/${orderId}/escrow`,
    cookie: adminCookie,
  });

  assert(
    response.statusCode === 400 || response.statusCode === 409,
    `[ERROR] Doble creación de escrow debería retornar 400/409. Status recibido: ${response.statusCode}.`
  );

  const transactionCount = await prisma.transaction.count({
    where: { orderId },
  });

  assert(transactionCount === 1, `[ERROR] Doble escrow duplicó la transacción. Encontradas: ${transactionCount}`);
  console.log('[OK] Doble escrow rechazado sin duplicar transacción.');
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
  });

  try {
    const response = await request({
      method: 'POST',
      route: `/api/orders/${unpaidOrder.id}/escrow`,
      cookie: adminCookie,
    });

    assert(
      response.statusCode === 400 || response.statusCode === 403 || response.statusCode === 409,
      `[ERROR] Orden no pagada debería rechazar creación de escrow. Status: ${response.statusCode}.`
    );

    const transactionCount = await prisma.transaction.count({
      where: { orderId: unpaidOrder.id },
    });

    assert(transactionCount === 0, '[ERROR] Se creó Transaction para una orden no pagada.');
    console.log('[OK] Orden no pagada no puede crear escrow.');
  } finally {
    await prisma.order.delete({
      where: { id: unpaidOrder.id },
    });
  }
}

async function validatePaidOrderWithoutKeysRejection(adminCookie, buyerId, productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  assert(product, '[ERROR] No se encontró producto para crear orden negativa sin keys.');

  const unpaidOrder = await prisma.order.create({
    data: {
      userId: buyerId,
      paymentMethod: 'MERCADOPAGO',
      shippingPrice: 0,
      totalPrice: product.price,
      status: 'PENDING',
      isPaid: true,
      paidAt: new Date(),
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
  });

  try {
    const response = await request({
      method: 'POST',
      route: `/api/orders/${unpaidOrder.id}/escrow`,
      cookie: adminCookie,
    });

    assert(
      response.statusCode === 400 || response.statusCode === 409 || response.statusCode === 403,
      `[ERROR] Orden pagada sin keys debería rechazar creación de escrow. Status: ${response.statusCode}.`
    );

    const transactionCount = await prisma.transaction.count({
      where: { orderId: unpaidOrder.id },
    });

    assert(transactionCount === 0, '[ERROR] Se creó Transaction para una orden pagada sin keys.');
    console.log('[OK] Orden pagada sin keys no puede crear escrow.');
  } finally {
    await prisma.order.delete({
      where: { id: unpaidOrder.id },
    });
  }
}

async function main() {
  console.log('[INFO] Iniciando validación de Transacción en Custodia (Paso 8).');

  const assignedKeysRef = readJson(ASSIGNED_KEYS_FILE);
  const orderId = assignedKeysRef.orderId;

  assert(orderId, '[ERROR] m2-assigned-keys.json no contiene orderId.');

  console.log(`[INFO] Orden de entrada para Paso 8: ${orderId}.`);

  const initialOrder = await validateInitialOrder(orderId);

  console.log('[INFO] Iniciando login admin.');
  const adminCookie = await login(ADMIN_USER);
  console.log('[OK] Login admin validado con cookie HttpOnly.');

  console.log('[INFO] Iniciando login comprador.');
  const buyerCookie = await login(BUYER_USER);
  console.log('[OK] Login comprador validado con cookie HttpOnly.');

  await validateBuyerCannotCreateEscrow(orderId, buyerCookie);

  console.log('[INFO] Ejecutando creación de transacción escrow.');
  const escrowResponse = await request({
    method: 'POST',
    route: `/api/orders/${orderId}/escrow`,
    cookie: adminCookie,
  });

  assert(
    escrowResponse.statusCode === 200 || escrowResponse.statusCode === 201,
    `[ERROR] Endpoint de escrow falló. Status: ${escrowResponse.statusCode}. Body: ${JSON.stringify(escrowResponse.body)}`
  );

  assert(escrowResponse.body?.success === true, '[ERROR] Endpoint de escrow devolvió success=false.');

  console.log('[OK] Endpoint de escrow ejecutado correctamente.');
  console.log('[OK] Transaction creada correctamente.');

  const orderAfterEscrow = await getOrderSnapshot(orderId);
  const transaction = orderAfterEscrow.transaction;

  assert(transaction, '[ERROR] No se encontró la transacción en la base de datos.');
  assert(transaction.status === 'PENDING_APPROVAL', `[ERROR] Estado de transacción esperado PENDING_APPROVAL, obtenido: ${transaction.status}`);
  console.log('[OK] Estado PENDING_APPROVAL validado.');

  const expectedAmount = Number(orderAfterEscrow.totalPrice);
  const transactionAmount = Number(transaction.amount);
  assert(Math.abs(transactionAmount - expectedAmount) < 0.01, `[ERROR] Monto esperado $${expectedAmount}, obtenido $${transactionAmount}`);
  console.log('[OK] Monto de transacción coincide con total de la orden.');

  assert(transaction.sellerId, '[ERROR] sellerId no está presente en la transacción.');
  console.log('[OK] Seller asociado validado.');

  assert(transaction.approvedAt === null, '[ERROR] approvedAt no debe estar seteado.');
  assert(transaction.approvedBy === null, '[ERROR] approvedBy no debe estar seteado.');
  assert(transaction.rejectionReason === null, '[ERROR] rejectionReason no debe estar seteado.');
  console.log('[OK] La transacción no fue aprobada ni rechazada.');

  for (const key of orderAfterEscrow.digitalKeys) {
    assert(key.status === 'SOLD' || key.status === 'RESERVED', `[ERROR] Clave digital alterada. Estado: ${key.status}`);
  }
  console.log('[OK] Las keys digitales permanecen asignadas y SOLD.');

  console.log('[INFO] Validando doble creación de escrow.');
  await validateDoubleEscrow(orderId, adminCookie);

  console.log('[INFO] Validando rechazo para orden no pagada.');
  await validateUnpaidOrderRejection(
    adminCookie,
    orderAfterEscrow.userId,
    orderAfterEscrow.orderItems[0].productId
  );

  console.log('[INFO] Validando rechazo para orden pagada sin keys.');
  await validatePaidOrderWithoutKeysRejection(
    adminCookie,
    orderAfterEscrow.userId,
    orderAfterEscrow.orderItems[0].productId
  );

  // Guardar archivo de referencia para Paso 9
  const output = {
    orderId: orderAfterEscrow.id,
    buyerEmail: orderAfterEscrow.user.email,
    transactionId: transaction.id,
    sellerId: transaction.sellerId,
    amount: Number(transaction.amount),
    status: transaction.status,
    approvedBy: transaction.approvedBy || null,
    approvedAt: transaction.approvedAt || null,
    rejectionReason: transaction.rejectionReason || null,
    keysStillAssigned: true,
    totalAssignedKeys: orderAfterEscrow.digitalKeys.length,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');

  console.log(`[OK] Referencia de escrow guardada en scripts/m2-escrow-transaction.json.`);
  console.log('[OK] Validación de Transacción en Custodia finalizada correctamente.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[ERROR] Validación de Transacción en Custodia fallida.');
    console.error(error.message);

    await prisma.$disconnect();
    process.exit(1);
  });
