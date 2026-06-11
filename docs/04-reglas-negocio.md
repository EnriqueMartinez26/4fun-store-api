# Reglas de Negocio

El backend de **4Fun Store** restringe las operaciones de base de datos aplicando un conjunto estricto de reglas de negocio en la capa de servicios:

## 1. Reglas Relativas al Stock Digital

- **Validación preventiva de stock**: No se permite añadir al carrito ni generar una orden de compra para un videojuego si el número de claves libres (`DigitalKey` activas con estado `AVAILABLE`) es menor a la cantidad solicitada.
- **Asignación atómica**: Al procesarse el pago de la orden con éxito, el sistema debe de manera transaccional:
  1. Seleccionar la cantidad exacta de claves requeridas.
  2. Asociar esas claves al `Order` de forma permanente.
  3. Marcar las claves como vendidas (`SOLD`) y actualizar el stock disponible del producto.

## 2. Reglas de Descuentos (Cupones)

- **Cupón exclusivo**: El checkout valida un único cupón por operación; si pasa las validaciones, el backend incrementa su `usedCount` y conserva el registro del cupón de forma independiente al pedido.
- **Vigencia temporal**: Para validar un cupón se comprueba que la fecha del servidor sea menor o igual a la fecha de expiración del cupón.
- **Límite de uso**: Cada cupón dispone de una cantidad máxima de usos global; una vez alcanzada, el backend rechaza cualquier intento de validación posterior.

## 3. Reglas de Reseñas

- **Compra obligatoria**: Un usuario solo puede registrar una reseña y calificación para un videojuego si cuenta con al menos una orden pagada (`isPaid = true`) que contenga dicho videojuego y las claves ya hayan sido asignadas.

## 4. Reglas de Aprobación de Órdenes

- **Restricción de rol para administración**: Los cambios de estado logístico de las órdenes (`PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`) solo pueden realizarse por usuarios autenticados con rol `ADMIN`.
- **Separación financiera**: El estado del pedido no reemplaza el estado del pago. `Order.status` describe el ciclo logístico, mientras que `isPaid` y `Transaction.status` describen el circuito financiero y de custodia.
