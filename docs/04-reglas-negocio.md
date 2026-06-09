# Reglas de Negocio

El backend de **4Fun Store** restringe las operaciones de base de datos aplicando un conjunto estricto de reglas de negocio en la capa de servicios:

## 1. Reglas Relativas al Stock Digital

- **Validación Preventiva de Stock**: No se permite añadir al carrito ni generar una orden de compra para un videojuego si el número de claves libres (`DigitalKeys` no usadas ni reservadas) es menor a la cantidad solicitada.
- **Asignación Atómica**: Al procesarse el pago de la orden con éxito, el sistema debe de manera transaccional:
  1. Seleccionar la cantidad exacta de claves requeridas.
  2. Asociar esas claves al `OrderItem` de la orden de forma permanente.
  3. Marcar las claves como usadas (`isUsed = true`), retirándolas definitivamente del inventario disponible.

## 2. Reglas de Descuentos (Cupones)

- **Cupón Exclusivo**: Solo se permite aplicar un único cupón de descuento por cada orden generada (no acumulables).
- **Vigencia Temporal**: Para aplicar un cupón se valida que la fecha del servidor sea menor o igual a la fecha de expiración del cupón.
- **Límite de Uso**: Cada cupón dispone de una cantidad máxima de usos global; una vez alcanzada, el backend rechazará cualquier intento de validación posterior.

## 3. Reglas de Reseñas

- **Compra Obligatoria**: Un usuario solo puede registrar una reseña y calificación para un videojuego si cuenta con al menos una orden asociada en estado `COMPLETED` que contenga dicho videojuego.

## 4. Reglas de Aprobación de Órdenes

- **Restricción de Rol para Aprobación**: Los cambios de estado de las órdenes de compra a `COMPLETED` manuales solo pueden realizarse por usuarios autenticados con rol `ADMIN`.
