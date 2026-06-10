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

const RESOLUTION_FILE = path.join(__dirname, 'm2-admin-resolution.json');
const OUTPUT_FILE = path.join(__dirname, 'm2-buyer-history.json');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(filePath) {
  assert(fs.existsSync(filePath), `[ERROR] No existe el archivo de resolución: ${filePath}`);
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
  const setCookie = response.headers['set-cookie'];
  assert(Array.isArray(setCookie) && setCookie.length > 0, `[ERROR] Set-Cookie no recibido para ${user.email}.`);
  const tokenCookie = setCookie.find((c) => c.startsWith('token='));
  assert(tokenCookie, `[ERROR] Cookie de token no recibida para ${user.email}.`);
  assert(
    tokenCookie.toLowerCase().includes('httponly'),
    `[ERROR] Cookie token de ${user.email} no es HttpOnly.`
  );
  return tokenCookie.split(';')[0];
}

async function main() {
  console.log('[INFO] Iniciando validación de Historial Comprador (Paso 10).');

  const resolutionData = readJson(RESOLUTION_FILE);
  const orderId = resolutionData.mainApproval.orderId;
  const transactionId = resolutionData.mainApproval.transactionId;

  assert(orderId, '[ERROR] El archivo de resolución no contiene orderId.');
  assert(transactionId, '[ERROR] El archivo de resolución no contiene transactionId.');

  console.log(`[INFO] Orden de entrada para Paso 10: ${orderId}.`);

  // Validar resolución administrativa previa en base de datos
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });
  assert(tx, `[ERROR] La transacción ${transactionId} no existe en la base de datos.`);
  assert(tx.status === 'FUNDS_RELEASED', `[ERROR] La transacción debía estar en FUNDS_RELEASED. Estado actual: ${tx.status}`);
  console.log('[OK] Resolución administrativa previa validada: FUNDS_RELEASED.');

  // Login
  console.log('[INFO] Iniciando login comprador.');
  const buyerCookie = await login(BUYER_USER);
  console.log('[OK] Login comprador validado con cookie HttpOnly.');

  console.log('[INFO] Iniciando login admin.');
  const adminCookie = await login(ADMIN_USER);
  console.log('[OK] Login admin validado con cookie HttpOnly.');

  // Consultar historial
  console.log('[INFO] Consultando historial del comprador.');
  const historyResponse = await request({
    method: 'GET',
    route: '/api/orders/my-orders',
    cookie: buyerCookie,
  });

  assert(historyResponse.statusCode === 200, `[ERROR] Petición a historial falló con status: ${historyResponse.statusCode}`);
  assert(historyResponse.body?.success === true, '[ERROR] Respuesta de historial sin success=true.');
  console.log('[OK] Historial responde correctamente.');

  const orders = historyResponse.body.orders;
  assert(Array.isArray(orders), '[ERROR] La respuesta de historial no contiene un array de órdenes.');

  const mainOrder = orders.find((o) => o.id === orderId);
  assert(mainOrder, `[ERROR] Orden principal ${orderId} no encontrada en el historial del comprador.`);
  console.log('[OK] Orden principal encontrada en historial.');

  // Validar estado de pago, total, ítems
  assert(mainOrder.isPaid === true, `[ERROR] Estado de pago esperado isPaid=true, obtenido: ${mainOrder.isPaid}`);
  console.log('[OK] Estado de pago validado: isPaid=true.');

  assert(Number(mainOrder.totalPrice) === 149.97, `[ERROR] Total esperado 149.97, obtenido: ${mainOrder.totalPrice}`);
  console.log('[OK] Total de orden validado: 149.97.');

  const items = mainOrder.orderItems;
  assert(Array.isArray(items) && items.length === 2, `[ERROR] Se esperaban 2 ítems, obtenidos: ${items?.length}`);

  const spaceItem = items.find((i) => i.product?.name === 'Space Rift Digital');
  const pixelItem = items.find((i) => i.product?.name === 'Pixel Quest Digital');

  assert(spaceItem && spaceItem.quantity === 2, '[ERROR] Item Space Rift Digital x2 no validado.');
  assert(pixelItem && pixelItem.quantity === 1, '[ERROR] Item Pixel Quest Digital x1 no validado.');
  console.log('[OK] Items de orden validados: Space x2 y Pixel x1.');

  // Validar keys entregadas
  const digitalKeys = mainOrder.digitalKeys;
  assert(Array.isArray(digitalKeys) && digitalKeys.length === 3, `[ERROR] Se esperaban 3 llaves digitales en la orden, obtenidas: ${digitalKeys?.length}`);
  console.log('[OK] Keys digitales visibles para el comprador: 3.');

  // Validar pertenencia de keys por producto
  const spaceKeys = digitalKeys.filter((k) => k.productId === spaceItem.productId);
  const pixelKeys = digitalKeys.filter((k) => k.productId === pixelItem.productId);

  assert(spaceKeys.length === 2, `[ERROR] Se esperaban 2 keys para Space Rift Digital, obtenidas: ${spaceKeys.length}`);
  assert(pixelKeys.length === 1, `[ERROR] Se esperaban 1 key para Pixel Quest Digital, obtenida: ${pixelKeys.length}`);
  console.log('[OK] Keys digitales pertenecen a los productos correctos.');

  // Confirmar que no se imprimen keys completas en consola
  for (const k of digitalKeys) {
    assert(k.key && k.key.length > 5, '[ERROR] Formato de key inválido.');
    const sanitizedKey = k.key.substring(0, 5) + '...';
    console.log(`[OK] Validando key en evidencia: ID ${k.id} -> Preview: ${sanitizedKey}`);
  }
  console.log('[OK] No se imprimieron claves completas en evidencia.');

  // Detalle de orden como comprador
  console.log('[INFO] Consultando detalle de orden como comprador.');
  const detailResponse = await request({
    method: 'GET',
    route: `/api/orders/${orderId}`,
    cookie: buyerCookie,
  });

  assert(detailResponse.statusCode === 200, `[ERROR] Detalle de orden falló para el comprador. Status: ${detailResponse.statusCode}`);
  assert(detailResponse.body?.success === true, '[ERROR] Respuesta de detalle sin success=true.');
  console.log('[OK] Comprador puede ver detalle de su orden.');

  // Detalle de orden como admin
  console.log('[INFO] Consultando detalle de orden como administrador.');
  const adminDetailResponse = await request({
    method: 'GET',
    route: `/api/orders/${orderId}`,
    cookie: adminCookie,
  });
  assert(adminDetailResponse.statusCode === 200, `[ERROR] Detalle de orden falló para el administrador. Status: ${adminDetailResponse.statusCode}`);
  console.log('[OK] Administrador puede ver detalle de la orden.');

  // Validar aislamiento: otro buyer no puede ver el detalle de la orden
  console.log('[INFO] Registrando comprador auxiliar para validar aislamiento transaccional.');
  const otherBuyerUser = {
    name: 'Otro Comprador',
    email: `otherbuyer-${Date.now()}@4fun.test`,
    password: 'password123',
  };

  const registerRes = await request({
    method: 'POST',
    route: '/api/auth/register',
    body: otherBuyerUser,
  });
  assert(registerRes.statusCode === 201, `[ERROR] Registro de comprador auxiliar falló. Status: ${registerRes.statusCode}`);

  // Buscar token de verificación en base de datos para activarlo
  const tempUser = await prisma.user.findUnique({
    where: { email: otherBuyerUser.email },
  });
  assert(tempUser, '[ERROR] Comprador auxiliar no encontrado en base de datos.');

  await prisma.user.update({
    where: { email: otherBuyerUser.email },
    data: { isVerified: true },
  });

  const otherBuyerCookie = await login({
    email: otherBuyerUser.email,
    password: otherBuyerUser.password,
  });

  try {
    console.log('[INFO] Validando acceso no autorizado a orden de otro comprador.');
    const otherDetailRes = await request({
      method: 'GET',
      route: `/api/orders/${orderId}`,
      cookie: otherBuyerCookie,
    });

    assert(otherDetailRes.statusCode === 403, `[ERROR] Otro comprador debería recibir un 403. Status obtenido: ${otherDetailRes.statusCode}`);
    console.log('[OK] Aislamiento transaccional validado. Otro comprador bloqueado con 403.');
  } finally {
    // Limpieza
    await prisma.user.delete({
      where: { email: otherBuyerUser.email },
    });
    console.log('[INFO] Limpieza de comprador auxiliar finalizada.');
  }

  // Validar estado financiero final en base de datos
  console.log('[INFO] Validando estado financiero final en base de datos.');
  const finalTx = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });
  assert(finalTx.status === 'FUNDS_RELEASED', `[ERROR] La transacción final debería estar en FUNDS_RELEASED. Estado: ${finalTx.status}`);
  console.log('[OK] Transacción asociada está en FUNDS_RELEASED.');

  // Guardar archivo m2-buyer-history.json
  const outputData = {
    orderId,
    buyerEmail: BUYER_USER.email,
    isPaid: mainOrder.isPaid,
    orderStatus: mainOrder.status,
    transactionStatus: finalTx.status,
    totalPrice: Number(mainOrder.totalPrice),
    products: [
      {
        name: 'Space Rift Digital',
        quantity: spaceItem.quantity,
        assignedKeys: spaceKeys.length,
      },
      {
        name: 'Pixel Quest Digital',
        quantity: pixelItem.quantity,
        assignedKeys: pixelKeys.length,
      },
    ],
    totalVisibleKeys: digitalKeys.length,
    keysAreSanitizedInEvidence: true,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2), 'utf8');
  console.log('[OK] Referencia de historial guardada en scripts/m2-buyer-history.json.');
  console.log('[OK] Validación de Historial Comprador finalizada correctamente.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[ERROR] Validación de Historial Comprador fallida.');
    console.error(error.message);
    await prisma.$disconnect();
    process.exit(1);
  });
