# Modelo de Datos

La persistencia de datos está modelada sobre una base de datos relacional **PostgreSQL**, utilizando **Prisma ORM** como motor de mapeo objeto-relacional.

## Entidades Principales

1. **User (Usuario)**:
   - Contiene credenciales, datos de perfil, estado de verificación de correo y rol asignado (`USER` o `ADMIN`).
   
2. **Product (Producto)**:
   - Representa los videojuegos del catálogo. Incluye campos como título, descripción, precio, estado de publicación y especificaciones mínimas/recomendadas para PC.

3. **Platform (Plataforma)** y **Genre (Género)**:
   - Tablas maestras para categorizar de forma organizada los videojuegos.

4. **DigitalKey (Clave Digital)**:
   - Inventario de claves únicas de activación. Cada registro está asociado a un `Product`. Cuando el producto es pagado, esta clave se enlaza a un `OrderItem` y se marca como utilizada.

5. **Cart (Carrito)** y **CartItem (Ítem del Carrito)**:
   - Almacena de forma persistente los productos que un usuario ha seleccionado temporalmente antes de iniciar una orden de compra.

6. **Order (Orden)** y **OrderItem (Ítem de la Orden)**:
   - Registra el encabezado y el detalle de una compra. Almacena montos, estado (`PENDING`, `COMPLETED`, `CANCELLED`) y el cupón aplicado.

7. **Coupon (Cupón)**:
   - Cupones de descuento aplicables a las órdenes. Almacenan porcentaje de descuento, fecha de expiración y límites de uso.

8. **Review (Reseña)**:
   - Calificación (estrellas) y comentario textual que un usuario realiza sobre un producto adquirido.

## Relaciones Críticas

- **Relación de Stock (1 a N)**: Un `Product` tiene muchas `DigitalKeys`. El stock disponible en tiempo real se calcula contando las claves asociadas que no han sido vendidas/usadas.
- **Relación de Compra (N a M)**: Un `User` puede generar muchas `Orders`, las cuales contienen múltiples `OrderItems` enlazados a `Products`.
