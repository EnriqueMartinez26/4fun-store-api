const http = require('http');

console.log('[INFO] Iniciando validación de Catálogo Digital en Frontend.');

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${path}`, (res) => {
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
    // 1. Validar ruta HTML de productos en frontend (puerto 9002)
    console.log('[INFO] Validando visualización de productos en la ruta /productos en frontend.');
    const productsPage = await get(9002, '/productos');
    if (productsPage.statusCode !== 200) {
      throw new Error(`Fallo al cargar /productos en el frontend. Status: ${productsPage.statusCode}`);
    }
    console.log('[OK] Visualización de productos en /productos validada.');

    // 2. Validar filtros a través del proxy de Next.js (puerto 9002 -> reenvío al backend)
    console.log('[INFO] Validando filtros de búsqueda, género y plataforma desde la interfaz (vía proxy).');
    
    // Búsqueda por texto "Space"
    const searchRes = await get(9002, '/api/products?search=Space');
    if (searchRes.statusCode !== 200 || !searchRes.body.success || searchRes.body.data.length === 0) {
      throw new Error('Fallo en búsqueda a través del proxy del frontend.');
    }
    console.log('[OK] Búsqueda por texto validada a través del proxy.');

    // Filtro por plataforma "pc"
    const platformRes = await get(9002, '/api/products?platform=pc');
    if (platformRes.statusCode !== 200 || !platformRes.body.success || platformRes.body.data.length === 0) {
      throw new Error('Fallo en filtro por plataforma a través del proxy del frontend.');
    }
    console.log('[OK] Filtro por plataforma validado a través del proxy.');

    // Filtro por género "rpg"
    const genreRes = await get(9002, '/api/products?genre=rpg');
    if (genreRes.statusCode !== 200 || !genreRes.body.success || genreRes.body.data.length === 0) {
      throw new Error('Fallo en filtro por género a través del proxy del frontend.');
    }
    console.log('[OK] Filtro por género validado a través del proxy.');

    // 3. Validar filtros combinados a través del proxy
    console.log('[INFO] Validando sincronización y filtros combinados en el frontend.');
    const combinedRes = await get(9002, '/api/products?platform=pc&genre=rpg&search=Space');
    if (combinedRes.statusCode !== 200 || !combinedRes.body.success || combinedRes.body.data.length === 0) {
      throw new Error('Fallo en filtros combinados a través del proxy del frontend.');
    }
    console.log('[OK] Filtros combinados y sincronizados correctamente.');

    console.log('[OK] Validación de Catálogo Digital en Frontend finalizada correctamente.');
    process.exit(0);
  } catch (error) {
    console.error(`[ERROR] Validación de frontend fallida: ${error.message}`);
    process.exit(1);
  }
}

run();
