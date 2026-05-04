const GenreService = require('../services/genreService');
const logger = require('../utils/logger');

async function main() {
  const id = '4005d621-0f5c-46d7-8000-872a3fd71538';
  try {
    console.log('--- Intentando obtener género ---');
    const genre = await GenreService.getGenreById(id);
    console.log('Resultado:', JSON.stringify(genre, null, 2));
  } catch (error) {
    console.error('Error capturado:', error.message, error.statusCode);
  }
}

main();
