const parseBulkIds = require('../utils/parseBulkIds');

describe('parseBulkIds', () => {
  test('debe retornar un array si el body ya es un array', () => {
    const req = { body: ['id1', 'id2'] };
    expect(parseBulkIds(req)).toEqual(['id1', 'id2']);
  });

  test('debe retornar un array de la propiedad ids del body', () => {
    const req = { body: { ids: ['id1', 'id2'] } };
    expect(parseBulkIds(req)).toEqual(['id1', 'id2']);
  });

  test('debe parsear un string separado por comas desde la query', () => {
    const req = { query: { ids: 'id1,id2' }, body: {} };
    expect(parseBulkIds(req)).toEqual(['id1', 'id2']);
  });

  test('debe retornar un array vacío si no hay ids en query ni en body', () => {
    const req = { query: {}, body: {} };
    expect(parseBulkIds(req)).toEqual([]);
  });
});
