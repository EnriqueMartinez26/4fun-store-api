const http = require('http');

const FRONTEND_PORT = 9002;

const BUYER = {
  email: 'buyer@4fun.test',
  password: 'password123',
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
        hostname: 'localhost',
        port: FRONTEND_PORT,
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
            json = data;
          }

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
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
  assert(Array.isArray(setCookieHeader), '[ERROR] Login por proxy no devolvió Set-Cookie.');
  const tokenCookie = setCookieHeader.find((cookie) => cookie.startsWith('token='));
  assert(tokenCookie, '[ERROR] No se encontró cookie token desde frontend proxy.');
  assert(tokenCookie.includes('HttpOnly'), '[ERROR] La cookie token no conserva HttpOnly.');
  return tokenCookie.split(';')[0];
}

async function main() {
  console.log('[INFO] Iniciando validación de Carrito vía Frontend Proxy.');

  const productsPage = await request({
    method: 'GET',
    path: '/productos',
  });

  assert(productsPage.statusCode === 200, `/productos debía responder 200, respondió ${productsPage.statusCode}.`);

  console.log('[OK] Ruta /productos responde correctamente desde frontend.');

  const login = await request({
    method: 'POST',
    path: '/api/auth/login',
    body: BUYER,
  });

  assert(login.statusCode === 200, `Login por proxy debía responder 200, respondió ${login.statusCode}.`);

  const cookie = extractCookie(login.headers['set-cookie']);

  console.log('[OK] Login por proxy validado con cookie HttpOnly.');

  const cart = await request({
    method: 'GET',
    path: '/api/cart',
    cookie,
  });

  assert(cart.statusCode === 200, `GET /api/cart por proxy debía responder 200, respondió ${cart.statusCode}.`);

  console.log('[OK] Consulta de carrito por proxy validada.');
  console.log('[OK] Validación de Carrito vía Frontend Proxy finalizada correctamente.');
}

main().catch((error) => {
  console.error('[ERROR] Validación de Carrito vía Frontend Proxy fallida.');
  console.error(error.message);
  process.exit(1);
});
