# Modelo de Datos

La persistencia de datos está modelada sobre una base de datos relacional **PostgreSQL**, utilizando **Prisma ORM** como motor de mapeo objeto-relacional.

## Entidades Principales

1. **User (Usuario)**:
   - Contiene credenciales, datos de perfil, estado de verificación de correo y rol asignado (`BUYER`, `SELLER` o `ADMIN`).

2. **SellerProfile (Perfil de vendedor)**:
   - Extiende a `User` cuando el rol es vendedor y centraliza datos específicos del comercio, como nombre de tienda, cuenta bancaria y aprobación administrativa.

3. **Product (Producto)**:
   - Representa videojuegos digitales del catálogo. Incluye nombre, descripción, precio, tipo, estado de publicación, descuento temporal y clasificación por plataforma y género.

4. **Platform (Plataforma)** y **Genre (Género)**:
   - Tablas maestras para categorizar de forma organizada los productos.

5. **ProductRequirement (Requerimiento técnico)**:
   - Normaliza los requisitos mínimos o recomendados de cada producto sin usar JSON embebido.

6. **DigitalKey (Clave digital)**:
   - Inventario de licencias únicas asociadas a un `Product`. El stock operativo se controla con las claves en estado `AVAILABLE` y se sincroniza en el campo `Product.stock` como caché de disponibilidad; cuando una compra se confirma y se asignan claves, pasan a `SOLD` y quedan vinculadas a la orden.

7. **Cart (Carrito)** y **CartItem (Ítem del carrito)**:
   - Almacenan de forma persistente los productos que un usuario selecciona antes de iniciar una orden de compra.

8. **Order (Orden)** y **OrderItem (Ítem de la orden)**:
   - Registran el encabezado y el detalle de la compra. `Order.status` modela el ciclo logístico (`PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`) y no reemplaza el estado financiero, que se guarda en `isPaid`, `paidAt` y `Transaction`.

9. **ShippingAddress (Dirección de envío)** y **Payment (Pago)**:
   - Normalizan los datos de envío y la información de la pasarela de pago para evitar duplicación en `Order`.

10. **Transaction (Escrow)**:
   - Representa la custodia de fondos asociada a una orden pagada. Su estado es independiente del estado logístico de la orden y se gestiona con `PENDING_APPROVAL`, `FUNDS_RELEASED`, `REJECTED` o `CANCELLED`.

11. **Coupon (Cupón)**:
   - Cupones de descuento con código único, vigencia, límite de uso y valor de descuento.

12. **Review (Reseña)** y **ReviewHelpfulVote (Voto útil)**:
   - Reseñas de productos y votos de utilidad normalizados en tablas separadas.

13. **Wishlist (Lista de deseos)** y **WishlistItem (Ítem de lista)**:
   - Persisten la relación entre usuarios y productos guardados para seguimiento posterior.

## Relaciones Críticas

- **Relación de stock (1 a N)**: Un `Product` tiene muchas `DigitalKey`. El stock operativo se deriva de las claves activas con estado `AVAILABLE` y se refleja en `Product.stock` para consultas rápidas.
- **Relación de compra (1 a N)**: Un `User` puede generar muchas `Order`, cada una con múltiples `OrderItem` enlazados a `Product`.
- **Separación financiera**: El estado del pedido, el pago y la custodia no se mezclan en un solo campo. `Order.status`, `Order.isPaid` y `Transaction.status` resuelven problemas distintos.
- **Relación vendedor-producto**: Cada `Product` pertenece a un vendedor; si el usuario tiene rol `SELLER`, puede estar asociado además a un `SellerProfile`.
