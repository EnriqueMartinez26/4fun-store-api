# Estrategia de Pruebas

Para garantizar la fiabilidad del backend frente a refactorizaciones, se implementó una suite de pruebas automatizadas enfocadas en las secciones más críticas de la API.

## Tecnologías Utilizadas

- **Jest**: Framework principal de testing para aserciones, mocks y ejecución del runner.
- **node-mocks-http**: Utilidad para simular objetos `request` y `response` de Express de forma aislada, permitiendo testear controladores sin necesidad de levantar el servidor HTTP.

## Áreas Cubiertas

1. **Middlewares de Acceso**:
   - Pruebas unitarias sobre `auth.middleware.ts` para verificar el bloqueo de usuarios sin sesión válida.
   - Verificación de la restricción de privilegios basándose en el rol del usuario (por ejemplo, validar que endpoints de administración respondan `403 Forbidden` a usuarios con rol `USER`).

2. **Lógica de Cupones**:
   - Pruebas para validar que el sistema calcule correctamente los descuentos y rechace de forma controlada cupones inválidos o expirados.

3. **Lógica de Órdenes**:
   - Validación del flujo de creación de órdenes y verificación de retornos JSON acordes a las especificaciones.

## Comando de Ejecución

```bash
# Ejecutar suite de pruebas en el backend
npm test
```
