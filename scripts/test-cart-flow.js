const http = require('http');
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

const CART_ENDPOINTS = {
  get: '/api/cart',
  add: '/api/cart',
  update: (cartItemId) => `/api/cart/${cartItemId}`,
  remove: (cartItemId) => `/api/cart/${cartItemId}`,
  clear: '/api/cart',
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

function isErrorStatus(statusCode) {
  return [400, 401, 403, 404, 409, 422].includes(statusCode);
}

function extractCookie(setCookieHeader) {
  assert(Array.isArray(setCookieHeader), '[ERROR] Login no devolvió Set-Cookie.');
  const tokenCookie = setCookieHeader.find((cookie) => cookie.startsWith('token='));
  assert(tokenCookie, '[ERROR] No se encontró cookie token.');
  assert(tokenCookie.includes('HttpOnly'), '[ERROR] La cookie token no tiene HttpOnly.');
  return tokenCookie.split(';')[0];
}

function cartItemsFromResponse(response) {
  const body = response.body;

  if (!body) return [];

  // Ajustado para extraer del wrapper response { success: true, cart: { items: [...] } }
  const cartData = body.cart || body.data || body;
  if (!cartData) return [];

  if (Array.isArray(cartData.items)) return cartData.items;
  if (Array.isArray(cartData.cartItems)) return cartData.cartItems;
  if (Array.isArray(cartData)) return cartData;

  return [];
}

function getItemProductName(item) {
  return item.product?.name || item.productName || item.name;
}

function getItemQuantity(item) {
  return item.quantity ?? item.qty ?? item.amount;
}

function getItemId(item) {
  return item.id || item.cartItemId;
}

function findCartItem(items, productName) {
  return items.find((item) => getItemProductName(item) === productName);
}

async function getProductByName(name) {
  const product = await prisma.product.findFirst({
    where: { name },
  });

  assert(product, `[ERROR] No se encontró producto seed: ${name}.`);
  return product;
}

async function countAvailableKeys(productId) {
  return prisma.digitalKey.count({
    where: {
      productId,
      status: 'AVAILABLE',
    },
  });
}

async function countAssignedOrSoldKeys(productId) {
  return prisma.digitalKey.count({
    where: {
      productId,
      status: {
        in: ['SOLD', 'RESERVED'],
      },
    },
  });
}

async function cleanupBuyerCart() {
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

async function assertNoOrdersOrTransactionsCreated() {
  const buyer = await prisma.user.findUnique({
    where: { email: BUYER.email },
  });

  assert(buyer, '[ERROR] No existe el comprador seeded.');

  const orders = await prisma.order.count({
    where: { userId: buyer.id },
  });

  const transactions = await prisma.transaction.count({
    where: {
      OR: [
        { sellerId: buyer.id },
        { userId: buyer.id },
      ],
    },
  }).catch(async () => {
    return prisma.transaction.count({
      where: { sellerId: buyer.id },
    });
  });

  assert(orders === 0, `[ERROR] Paso 4 no debe crear órdenes. Órdenes encontradas: ${orders}.`);
  assert(transactions === 0, `[ERROR] Paso 4 no debe crear transacciones. Transacciones encontradas: ${transactions}.`);
}

async function main() {
  console.log('[INFO] Iniciando validación de Carrito y Stock Digital.');

  console.log('[INFO] Limpiando carrito previo del comprador.');
  await cleanupBuyerCart();

  const space = await getProductByName(PRODUCT_NAMES.space);
  const pixel = await getProductByName(PRODUCT_NAMES.pixel);
  const noKeys = await getProductByName(PRODUCT_NAMES.noKeys);

  const initialSpaceKeys = await countAvailableKeys(space.id);
  const initialPixelKeys = await countAvailableKeys(pixel.id);
  const initialNoKeys = await countAvailableKeys(noKeys.id);

  assert(initialSpaceKeys === 3, `[ERROR] Space Rift Digital debería tener 3 keys AVAILABLE, tiene ${initialSpaceKeys}.`);
  assert(initialPixelKeys === 1, `[ERROR] Pixel Quest Digital debería tener 1 key AVAILABLE, tiene ${initialPixelKeys}.`);
  assert(initialNoKeys === 0, `[ERROR] No Keys Demo debería tener 0 keys AVAILABLE, tiene ${initialNoKeys}.`);

  console.log('[OK] Stock digital inicial validado por keys AVAILABLE.');

  console.log('[INFO] Iniciando login del comprador seeded.');
  const login = await request({
    method: 'POST',
    path: '/api/auth/login',
    body: BUYER,
  });

  assert(login.statusCode === 200, `[ERROR] Login debía responder 200, respondió ${login.statusCode}.`);
  assert(login.body?.success === true, '[ERROR] Login no devolvió success=true.');

  const cookie = extractCookie(login.headers['set-cookie']);

  console.log('[OK] Login comprador validado con cookie HttpOnly.');

  console.log('[INFO] Validando carrito inicial vacío.');
  const initialCart = await request({
    method: 'GET',
    path: CART_ENDPOINTS.get,
    cookie,
  });

  assert(initialCart.statusCode === 200, `[ERROR] GET carrito debía responder 200, respondió ${initialCart.statusCode}.`);

  const initialItems = cartItemsFromResponse(initialCart);
  assert(initialItems.length === 0, `[ERROR] El carrito inicial debía estar vacío. Items encontrados: ${initialItems.length}.`);

  console.log('[OK] Carrito inicial vacío validado.');

  console.log('[INFO] Agregando Space Rift Digital x1.');
  const addSpace = await request({
    method: 'POST',
    path: CART_ENDPOINTS.add,
    cookie,
    body: {
      productId: space.id,
      quantity: 1,
    },
  });

  assert([200, 201].includes(addSpace.statusCode), `[ERROR] Agregar Space x1 debía responder 200/201, respondió ${addSpace.statusCode}.`);

  let cart = await request({
    method: 'GET',
    path: CART_ENDPOINTS.get,
    cookie,
  });

  let items = cartItemsFromResponse(cart);
  let spaceItem = findCartItem(items, PRODUCT_NAMES.space);

  assert(spaceItem, '[ERROR] Space Rift Digital no quedó en el carrito.');
  assert(getItemQuantity(spaceItem) === 1, `[ERROR] Space debía quedar con quantity=1, quedó ${getItemQuantity(spaceItem)}.`);

  console.log('[OK] Space Rift Digital agregado al carrito con quantity=1.');

  console.log('[INFO] Actualizando Space Rift Digital a quantity=3.');
  const spaceItemId = getItemId(spaceItem);

  assert(spaceItemId, '[ERROR] No se pudo obtener id del cart item de Space.');

  const updateSpace = await request({
    method: 'PATCH',
    path: CART_ENDPOINTS.update(spaceItemId),
    cookie,
    body: {
      quantity: 3,
    },
  });

  assert(updateSpace.statusCode === 200, `[ERROR] Actualizar Space a 3 debía responder 200, respondió ${updateSpace.statusCode}.`);

  cart = await request({
    method: 'GET',
    path: CART_ENDPOINTS.get,
    cookie,
  });

  items = cartItemsFromResponse(cart);
  spaceItem = findCartItem(items, PRODUCT_NAMES.space);

  assert(spaceItem, '[ERROR] Space Rift Digital desapareció del carrito.');
  assert(getItemQuantity(spaceItem) === 3, `[ERROR] Space debía quedar con quantity=3, quedó ${getItemQuantity(spaceItem)}.`);

  console.log('[OK] Actualización dentro de stock validada.');

  console.log('[INFO] Intentando superar stock de Space Rift Digital con quantity=4.');
  const overStockSpace = await request({
    method: 'PATCH',
    path: CART_ENDPOINTS.update(getItemId(spaceItem)),
    cookie,
    body: {
      quantity: 4,
    },
  });

  assert(
    isErrorStatus(overStockSpace.statusCode),
    `[ERROR] Superar stock debía devolver error controlado, respondió ${overStockSpace.statusCode}.`
  );

  cart = await request({
    method: 'GET',
    path: CART_ENDPOINTS.get,
    cookie,
  });

  items = cartItemsFromResponse(cart);
  spaceItem = findCartItem(items, PRODUCT_NAMES.space);

  assert(spaceItem, '[ERROR] Space Rift Digital no debería desaparecer tras intento inválido.');
  assert(getItemQuantity(spaceItem) !== 4, '[ERROR] El carrito aceptó quantity=4 aunque solo existen 3 keys.');

  console.log('[OK] Bloqueo de sobrestock para Space Rift Digital validado.');

  console.log('[INFO] Agregando Pixel Quest Digital x1.');
  const addPixel = await request({
    method: 'POST',
    path: CART_ENDPOINTS.add,
    cookie,
    body: {
      productId: pixel.id,
      quantity: 1,
    },
  });

  assert([200, 201].includes(addPixel.statusCode), `[ERROR] Agregar Pixel x1 debía responder 200/201, respondió ${addPixel.statusCode}.`);

  cart = await request({
    method: 'GET',
    path: CART_ENDPOINTS.get,
    cookie,
  });

  items = cartItemsFromResponse(cart);
  let pixelItem = findCartItem(items, PRODUCT_NAMES.pixel);

  assert(pixelItem, '[ERROR] Pixel Quest Digital no quedó en el carrito.');
  assert(getItemQuantity(pixelItem) === 1, `[ERROR] Pixel debía quedar con quantity=1, quedó ${getItemQuantity(pixelItem)}.`);

  console.log('[OK] Pixel Quest Digital agregado con stock unitario.');

  console.log('[INFO] Intentando superar stock de Pixel Quest Digital con quantity=2.');
  const overStockPixel = await request({
    method: 'PATCH',
    path: CART_ENDPOINTS.update(getItemId(pixelItem)),
    cookie,
    body: {
      quantity: 2,
    },
  });

  assert(
    isErrorStatus(overStockPixel.statusCode),
    `[ERROR] Superar stock de Pixel debía devolver error controlado, respondió ${overStockPixel.statusCode}.`
  );

  cart = await request({
    method: 'GET',
    path: CART_ENDPOINTS.get,
    cookie,
  });

  items = cartItemsFromResponse(cart);
  pixelItem = findCartItem(items, PRODUCT_NAMES.pixel);

  assert(pixelItem, '[ERROR] Pixel Quest Digital no debería desaparecer tras intento inválido.');
  assert(getItemQuantity(pixelItem) !== 2, '[ERROR] El carrito aceptó Pixel quantity=2 aunque solo existe 1 key.');

  console.log('[OK] Bloqueo de sobrestock para Pixel Quest Digital validado.');

  console.log('[INFO] Intentando agregar producto agotado No Keys Demo.');
  const addNoKeys = await request({
    method: 'POST',
    path: CART_ENDPOINTS.add,
    cookie,
    body: {
      productId: noKeys.id,
      quantity: 1,
    },
  });

  assert(
    isErrorStatus(addNoKeys.statusCode),
    `[ERROR] Agregar producto agotado debía devolver error controlado, respondió ${addNoKeys.statusCode}.`
  );

  cart = await request({
    method: 'GET',
    path: CART_ENDPOINTS.get,
    cookie,
  });

  items = cartItemsFromResponse(cart);
  const noKeysItem = findCartItem(items, PRODUCT_NAMES.noKeys);

  assert(!noKeysItem, '[ERROR] No Keys Demo no debe quedar agregado al carrito.');

  console.log('[OK] Bloqueo de producto OUT_OF_STOCK validado.');

  console.log('[INFO] Validando que el carrito no consuma ni asigne keys.');
  const finalSpaceKeys = await countAvailableKeys(space.id);
  const finalPixelKeys = await countAvailableKeys(pixel.id);
  const finalNoKeys = await countAvailableKeys(noKeys.id);

  assert(finalSpaceKeys === initialSpaceKeys, `[ERROR] Space cambió keys AVAILABLE de ${initialSpaceKeys} a ${finalSpaceKeys}.`);
  assert(finalPixelKeys === initialPixelKeys, `[ERROR] Pixel cambió keys AVAILABLE de ${initialPixelKeys} a ${finalPixelKeys}.`);
  assert(finalNoKeys === initialNoKeys, `[ERROR] No Keys cambió keys AVAILABLE de ${initialNoKeys} a ${finalNoKeys}.`);

  const assignedSpaceKeys = await countAssignedOrSoldKeys(space.id);
  const assignedPixelKeys = await countAssignedOrSoldKeys(pixel.id);
  const assignedNoKeys = await countAssignedOrSoldKeys(noKeys.id);

  assert(assignedSpaceKeys === 0, `[ERROR] Space tiene keys asignadas/vendidas/reservadas en Paso 4: ${assignedSpaceKeys}.`);
  assert(assignedPixelKeys === 0, `[ERROR] Pixel tiene keys asignadas/vendidas/reservadas en Paso 4: ${assignedPixelKeys}.`);
  assert(assignedNoKeys === 0, `[ERROR] No Keys tiene keys asignadas/vendidas/reservadas en Paso 4: ${assignedNoKeys}.`);

  console.log('[OK] El carrito no consumió ni asignó keys digitales.');

  console.log('[INFO] Validando que Paso 4 no cree órdenes ni transacciones.');
  await assertNoOrdersOrTransactionsCreated();

  console.log('[OK] No se crearon órdenes ni transacciones.');

  console.log('[INFO] Eliminando Pixel Quest Digital del carrito.');
  const removePixel = await request({
    method: 'DELETE',
    path: CART_ENDPOINTS.remove(getItemId(pixelItem)),
    cookie,
  });

  assert([200, 204].includes(removePixel.statusCode), `[ERROR] Eliminar Pixel debía responder 200/204, respondió ${removePixel.statusCode}.`);

  cart = await request({
    method: 'GET',
    path: CART_ENDPOINTS.get,
    cookie,
  });

  items = cartItemsFromResponse(cart);
  assert(!findCartItem(items, PRODUCT_NAMES.pixel), '[ERROR] Pixel Quest Digital no fue removido del carrito.');

  console.log('[OK] Eliminación de item validada.');

  console.log('[INFO] Limpiando carrito para no contaminar Paso 5.');
  await cleanupBuyerCart();

  const buyer = await prisma.user.findUnique({
    where: { email: BUYER.email },
  });

  const remainingItems = await prisma.cartItem.count({
    where: {
      cart: {
        userId: buyer.id,
      },
    },
  });

  assert(remainingItems === 0, `[ERROR] El carrito debía quedar vacío. Items restantes: ${remainingItems}.`);

  console.log('[OK] Limpieza final de carrito validada.');
  console.log('[OK] Validación de Carrito y Stock Digital finalizada correctamente.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[ERROR] Validación de Carrito y Stock Digital fallida.');
    console.error(error.message);

    try {
      await cleanupBuyerCart();
    } finally {
      await prisma.$disconnect();
      process.exit(1);
    }
  });
