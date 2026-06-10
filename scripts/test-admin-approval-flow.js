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

const ESCROW_FILE = path.join(__dirname, 'm2-escrow-transaction.json');
const OUTPUT_FILE = path.join(__dirname, 'm2-admin-resolution.json');

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

async function getTransactionSnapshot(txId) {
  return prisma.transaction.findUnique({
    where: { id: txId },
    include: {
      order: {
        include: {
          user: true,
          orderItems: {
            include: {
              product: true,
            },
          },
          digitalKeys: true,
        },
      },
    },
  });
}

async function validateInitialTransaction(txId) {
  const tx = await getTransactionSnapshot(txId);

  assert(tx, `[ERROR] La transacción ${txId} no existe.`);
  assert(tx.status === 'PENDING_APPROVAL', `[ERROR] Transacción debía iniciar en PENDING_APPROVAL. Estado obtenido: ${tx.status}`);
  assert(tx.approvedBy === null, '[ERROR] approvedBy debía ser null.');
  assert(tx.approvedAt === null, '[ERROR] approvedAt debía ser null.');
  assert(tx.rejectionReason === null, '[ERROR] rejectionReason debía ser null.');

  console.log('[OK] Transacción inicial validada: PENDING_APPROVAL, sin resolución previa.');
  return tx;
}

async function validateBuyerCannotApproveOrReject(txId, buyerCookie) {
  const approveRes = await request({
    method: 'POST',
    route: `/api/transactions/${txId}/approve`,
    cookie: buyerCookie,
  });
  assert(
    [401, 403].includes(approveRes.statusCode),
    `[ERROR] El comprador no debería poder aprobar. Status recibido: ${approveRes.statusCode}`
  );
  console.log('[OK] Comprador bloqueado para aprobar transacciones.');

  const rejectRes = await request({
    method: 'POST',
    route: `/api/transactions/${txId}/reject`,
    cookie: buyerCookie,
    body: { reason: 'Intento malicioso' },
  });
  assert(
    [401, 403].includes(rejectRes.statusCode),
    `[ERROR] El comprador no debería poder rechazar. Status recibido: ${rejectRes.statusCode}`
  );
  console.log('[OK] Comprador bloqueado para rechazar transacciones.');
}

async function main() {
  console.log('[INFO] Iniciando validación de Aprobación/Rechazo Administrativo (Paso 9).');

  const escrowRef = readJson(ESCROW_FILE);
  const txId = escrowRef.transactionId;

  assert(txId, '[ERROR] m2-escrow-transaction.json no contiene transactionId.');

  console.log(`[INFO] Transacción principal de entrada: ${txId}.`);

  const initialTx = await validateInitialTransaction(txId);

  console.log('[INFO] Iniciando login admin.');
  const adminCookie = await login(ADMIN_USER);
  console.log('[OK] Login admin validado con cookie HttpOnly.');

  console.log('[INFO] Iniciando login comprador.');
  const buyerCookie = await login(BUYER_USER);
  console.log('[OK] Login comprador validado con cookie HttpOnly.');

  await validateBuyerCannotApproveOrReject(txId, buyerCookie);

  console.log('[INFO] Ejecutando aprobación administrativa.');
  const approveResponse = await request({
    method: 'POST',
    route: `/api/transactions/${txId}/approve`,
    cookie: adminCookie,
  });

  assert(
    approveResponse.statusCode === 200 || approveResponse.statusCode === 201,
    `[ERROR] Aprobación falló. Status: ${approveResponse.statusCode}. Body: ${JSON.stringify(approveResponse.body)}`
  );

  console.log('[OK] Endpoint de aprobación ejecutado correctamente.');

  const finalTx = await getTransactionSnapshot(txId);

  assert(finalTx.status === 'FUNDS_RELEASED', `[ERROR] Estado de transacción esperado FUNDS_RELEASED, obtenido: ${finalTx.status}`);
  console.log('[OK] Transacción principal quedó en FUNDS_RELEASED.');

  assert(finalTx.approvedBy, '[ERROR] Admin aprobador no fue registrado.');
  console.log('[OK] Admin aprobador registrado.');

  assert(finalTx.approvedAt, '[ERROR] Fecha de aprobación no registrada.');
  console.log('[OK] Fecha de aprobación registrada.');

  assert(finalTx.rejectionReason === null, '[ERROR] El motivo de rechazo debe permanecer null.');
  console.log('[OK] Motivo de rechazo permanece null.');

  console.log('[INFO] Validando doble resolución sobre transacción aprobada.');
  const doubleApproveRes = await request({
    method: 'POST',
    route: `/api/transactions/${txId}/approve`,
    cookie: adminCookie,
  });
  assert(
    doubleApproveRes.statusCode === 400 || doubleApproveRes.statusCode === 409,
    `[ERROR] Doble aprobación sobre transacción resuelta debe fallar con 400/409. Recibido: ${doubleApproveRes.statusCode}`
  );
  console.log('[OK] Doble aprobación bloqueada.');

  const rejectAfterApproveRes = await request({
    method: 'POST',
    route: `/api/transactions/${txId}/reject`,
    cookie: adminCookie,
    body: { reason: 'Intento sobre aprobada' },
  });
  assert(
    rejectAfterApproveRes.statusCode === 400 || rejectAfterApproveRes.statusCode === 409,
    `[ERROR] Rechazo posterior a aprobación debe fallar con 400/409. Recibido: ${rejectAfterApproveRes.statusCode}`
  );
  console.log('[OK] Rechazo posterior a aprobación bloqueado.');

  console.log('[INFO] Creando transacción auxiliar para rechazo.');
  const auxOrder = await prisma.order.create({
    data: {
      userId: initialTx.order.userId,
      paymentMethod: 'MERCADOPAGO',
      shippingPrice: 0,
      totalPrice: 10.00,
      status: 'PENDING',
      isPaid: true,
      paidAt: new Date(),
    },
  });

  const auxTx = await prisma.transaction.create({
    data: {
      orderId: auxOrder.id,
      sellerId: initialTx.sellerId,
      amount: 10.00,
      status: 'PENDING_APPROVAL',
    },
  });

  console.log('[OK] Transacción auxiliar PENDING_APPROVAL creada.');

  try {
    console.log('[INFO] Validando rechazo sin motivo.');
    const rejectNoReasonRes = await request({
      method: 'POST',
      route: `/api/transactions/${auxTx.id}/reject`,
      cookie: adminCookie,
      body: {}, // Sin reason
    });

    assert(
      rejectNoReasonRes.statusCode === 400,
      `[ERROR] Rechazo sin motivo debería retornar 400. Status: ${rejectNoReasonRes.statusCode}`
    );
    console.log('[OK] Rechazo sin motivo bloqueado.');

    console.log('[INFO] Ejecutando rechazo administrativo con motivo.');
    const rejectReasonText = 'Motivo de prueba Paso 9';
    const rejectRes = await request({
      method: 'POST',
      route: `/api/transactions/${auxTx.id}/reject`,
      cookie: adminCookie,
      body: { reason: rejectReasonText },
    });

    assert(
      rejectRes.statusCode === 200 || rejectRes.statusCode === 201,
      `[ERROR] Rechazo falló. Status: ${rejectRes.statusCode}. Body: ${JSON.stringify(rejectRes.body)}`
    );

    console.log('[OK] Endpoint de rechazo ejecutado correctamente.');

    const finalAuxTx = await prisma.transaction.findUnique({
      where: { id: auxTx.id },
    });

    assert(finalAuxTx.status === 'REJECTED', `[ERROR] Estado de transacción esperado REJECTED, obtenido: ${finalAuxTx.status}`);
    console.log('[OK] Transacción auxiliar quedó en REJECTED.');

    assert(finalAuxTx.approvedBy, '[ERROR] Admin de resolución no registrado en rechazo.');
    console.log('[OK] Admin responsable registrado.');

    assert(finalAuxTx.rejectionReason === rejectReasonText, `[ERROR] Motivo esperado: "${rejectReasonText}", obtenido: "${finalAuxTx.rejectionReason}"`);
    console.log('[OK] Motivo de rechazo registrado.');

    console.log('[INFO] Validando doble rechazo.');
    const doubleRejectRes = await request({
      method: 'POST',
      route: `/api/transactions/${auxTx.id}/reject`,
      cookie: adminCookie,
      body: { reason: 'Otro motivo' },
    });
    assert(
      doubleRejectRes.statusCode === 400 || doubleRejectRes.statusCode === 409,
      `[ERROR] Doble rechazo debe fallar con 400/409. Recibido: ${doubleRejectRes.statusCode}`
    );
    console.log('[OK] Doble rechazo bloqueado.');

    // Guardar archivo de referencia
    const output = {
      mainApproval: {
        orderId: finalTx.orderId,
        transactionId: finalTx.id,
        previousStatus: 'PENDING_APPROVAL',
        finalStatus: finalTx.status,
        approvedBy: finalTx.approvedBy,
        approvedAt: finalTx.approvedAt,
        rejectionReason: finalTx.rejectionReason,
        amount: Number(finalTx.amount),
      },
      rejectionCase: {
        transactionId: finalAuxTx.id,
        previousStatus: 'PENDING_APPROVAL',
        finalStatus: finalAuxTx.status,
        resolvedBy: finalAuxTx.approvedBy,
        resolvedAt: finalAuxTx.approvedAt,
        rejectionReason: finalAuxTx.rejectionReason,
      },
      blockedCases: {
        buyerApprovalBlocked: true,
        buyerRejectionBlocked: true,
        doubleApprovalBlocked: true,
        approvalThenRejectBlocked: true,
        rejectWithoutReasonBlocked: true,
        doubleRejectBlocked: true,
      },
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
    console.log(`[OK] Referencia de resolución administrativa guardada en scripts/m2-admin-resolution.json.`);

  } finally {
    // Eliminar la transacción auxiliar y la orden auxiliar para limpiar la BD
    await prisma.transaction.delete({
      where: { id: auxTx.id },
    });
    await prisma.order.delete({
      where: { id: auxOrder.id },
    });
    console.log('[INFO] Limpieza de transacción y orden auxiliares finalizada.');
  }

  console.log('[OK] Validación de Aprobación/Rechazo Administrativo finalizada correctamente.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[ERROR] Validación de Aprobación/Rechazo Administrativo fallida.');
    console.error(error.message);

    await prisma.$disconnect();
    process.exit(1);
  });
