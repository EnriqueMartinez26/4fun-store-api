# Estrategia de Pruebas

Para garantizar la fiabilidad del backend y la robustez de las reglas de negocio de la tesis, se cuenta con una suite de pruebas automatizadas que cubren los flujos más críticos del sistema.

## Tecnologías Utilizadas

- **Jest**: Framework principal de testing para aserciones, espías y mocks.
- **Mocks Aislados de Prisma**: Permite la ejecución de las pruebas de servicios de manera aislada y veloz, sin depender de una base de datos PostgreSQL activa durante el proceso.

## Pruebas Críticas Implementadas

### 1. Autenticación e Identidad (`authService.test.js`)
- **Registro Correcto**: Verifica que se cree el usuario con contraseña cifrada y token de verificación cuando el email es único.
- **Registro Duplicado**: Valida que se lance un error si se intenta registrar una cuenta con un email que ya existe.
- **Login Exitoso**: Comprueba que un usuario con credenciales correctas acceda a su cuenta.
- **Login Fallido**: Valida que se rechace el login con credenciales erróneas e incremente el contador de intentos.
- **Bloqueo de Cuenta**: Garantiza que se bloquee temporalmente la cuenta (mediante `lockUntil`) al superar el límite de 5 intentos fallidos consecutivos.

### 2. Productos y Catálogo (`productService.test.js`)
- **Creación de Producto**: Verifica el correcto guardado de un videojuego digital con su clasificación.
- **Validación de Stock / Activación**: Asegura que el estado del producto digital pase a `OUT_OF_STOCK` automáticamente si se intenta activar sin stock de claves digitales en inventario.
- **Privacidad y Permisos (Seller Boundaries)**: Garantiza que un vendedor no pueda modificar o eliminar productos que pertenezcan a otro vendedor, mientras que un administrador posee permisos globales de edición.

### 3. Órdenes y Compras (`orderAndTransactionService.test.js`)
- **Carrito Vacío**: Rechaza la generación de una orden si el carrito no contiene productos.
- **Precio Consolidado desde DB**: Evita inyecciones de precios manipulando la request, obligando al sistema a recalcular los montos unitarios directamente desde la base de datos.
- **Falta de Stock de Claves**: Lanza un error al crear la orden si la cantidad de keys disponibles es insuficiente.
- **Creación de Orden Válida**: Genera una orden en estado `PENDING` de forma exitosa cuando se cumplen todos los requisitos.

### 4. Claves Digitales (`orderAndTransactionService.test.js`)
- **Asignación Atómica**: Comprueba que al marcar una orden como pagada, se busquen las keys correspondientes, se asocien a la orden, se marquen como usadas (`SOLD`) y se recalcule la disponibilidad del producto a partir de las keys restantes.
- **Protección contra Doble Asignación**: Valida que una clave solo sea asignable a una orden activa y no se asigne repetidas veces.

### 5. Transacciones y Escrow (`orderAndTransactionService.test.js`)
- **Retención de Fondos**: Verifica la creación automática de una transacción en estado `PENDING_APPROVAL` al pagarse una orden.
- **Aprobación de Fondos (Admin)**: Valida que el administrador pueda liberar los fondos (`FUNDS_RELEASED`) una vez vencida la ventana de disputa del cliente.
- **Rechazo con Motivo**: Asegura que el administrador pueda rechazar una transacción registrando el motivo de auditoría correspondiente.
- **Privacidad Transaccional**: Impide que un usuario no autorizado consulte el detalle de transacciones ajenas.

## Comando de Ejecución

```bash
# Ejecutar suite de pruebas en el backend
npm test
```
