const http = require('http');

console.log('[INFO] Iniciando validación de Catálogo Digital.');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:9003${path}`, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          // Si no es JSON, pasamos el string crudo
        }
        resolve({ statusCode: res.statusCode, body: json || data });
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    // 1. Validando listado base
    console.log('[INFO] Validando listado base.');
    const baseList = await get('/api/products');
    if (baseList.statusCode !== 200 || !baseList.body.success || !Array.isArray(baseList.body.data)) {
      throw new Error('Listado base falló.');
    }
    console.log('[OK] Listado base validado.');

    // 2. Validando taxonomías
    console.log('[INFO] Validando taxonomías.');
    const platforms = await get('/api/platforms');
    const genres = await get('/api/genres');
    if (platforms.statusCode !== 200 || !Array.isArray(platforms.body) || genres.statusCode !== 200 || !Array.isArray(genres.body)) {
      throw new Error('Validación de taxonomías falló.');
    }
    console.log('[OK] Taxonomías validadas.');

    // 3. Validando búsqueda por texto
    console.log('[INFO] Validando búsqueda por texto.');
    const searchRes = await get('/api/products?search=Space');
    if (searchRes.statusCode !== 200 || !searchRes.body.success || searchRes.body.data.length === 0) {
      throw new Error('Búsqueda por texto falló.');
    }
    console.log('[OK] Búsqueda por texto validada.');

    // 4. Validando filtro por plataforma
    console.log('[INFO] Validando filtro por plataforma.');
    const platformFilter = await get('/api/products?platform=pc');
    if (platformFilter.statusCode !== 200 || !platformFilter.body.success || platformFilter.body.data.length === 0) {
      throw new Error('Filtro por plataforma falló.');
    }
    console.log('[OK] Filtro por plataforma validado.');

    // 5. Validando filtro por género
    console.log('[INFO] Validando filtro por género.');
    const genreFilter = await get('/api/products?genre=rpg');
    if (genreFilter.statusCode !== 200 || !genreFilter.body.success || genreFilter.body.data.length === 0) {
      throw new Error('Filtro por género falló.');
    }
    console.log('[OK] Filtro por género validado.');

    // 6. Validando filtro combinado
    console.log('[INFO] Validando filtro combinado.');
    // Space Rift es PC y RPG, así que buscamos "Space" en PC y RPG
    const combinedFilter = await get('/api/products?platform=pc&genre=rpg&search=Space');
    if (combinedFilter.statusCode !== 200 || !combinedFilter.body.success || combinedFilter.body.data.length === 0) {
      throw new Error('Filtro combinado falló.');
    }
    console.log('[OK] Filtro combinado validado.');

    // 7. Validando rango de precio
    console.log('[INFO] Validando rango de precio.');
    // Pixel Quest Digital sale 29.99, minPrice=20, maxPrice=40 debería capturarlo
    const priceFilter = await get('/api/products?minPrice=20&maxPrice=40');
    if (priceFilter.statusCode !== 200 || !priceFilter.body.success || priceFilter.body.data.length === 0) {
      throw new Error('Rango de precio falló.');
    }
    console.log('[OK] Rango de precio validado.');

    // 8. Validando detalle de producto activo
    console.log('[INFO] Validando detalle de producto activo.');
    const prodActiveId = '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Space Rift Digital
    const activeDetail = await get(`/api/products/${prodActiveId}`);
    if (activeDetail.statusCode !== 200 || !activeDetail.body.success || activeDetail.body.data.name !== 'Space Rift Digital') {
      throw new Error('Detalle de producto activo falló.');
    }
    console.log('[OK] Detalle de producto activo validado.');

    // 9. Validando conducta de producto agotado (No Keys Demo tiene status OUT_OF_STOCK)
    console.log('[INFO] Validando conducta de producto agotado.');
    const prodNoKeysId = '10eebc99-9c0b-4ef8-bb6d-6bb9bd380a33'; // No Keys Demo
    const noKeysDetail = await get(`/api/products/${prodNoKeysId}`);
    // En la tienda pública getProductById lanza ErrorResponse('Producto no disponible', 404) para no ACTIVE.
    if (noKeysDetail.statusCode !== 404) {
      throw new Error(`Conducta de producto agotado incorrecta. Status recibido: ${noKeysDetail.statusCode}`);
    }
    console.log('[OK] Conducta de detalle agotado registrada con status 404.');

    console.log('[OK] Validación de Catálogo Digital finalizada correctamente.');
    process.exit(0);
  } catch (error) {
    console.error(`[ERROR] Validación fallida: ${error.message}`);
    process.exit(1);
  }
}

run();
