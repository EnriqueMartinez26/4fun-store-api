# Casos de Uso del Sistema

La API REST del backend está estructurada en base a los siguientes casos de uso principales clasificados según los actores del sistema:

## 1. Actor: Comprador (Usuario autenticado)

- **Registrar cuenta**: Crear un perfil de usuario con contraseña cifrada y envío de correo de confirmación.
- **Gestionar carrito de compras**: Añadir, modificar cantidades o eliminar videojuegos digitales en su carrito persistente en base de datos.
- **Crear orden de compra (checkout)**: Generar una orden en estado `PENDING`, consolidando los precios actuales de los videojuegos y reservando el stock de claves requeridas.
- **Validar cupón de descuento**: Comprobar que el cupón exista, esté activo, no haya vencido y cumpla el mínimo de compra antes de aplicarlo en el flujo de checkout.
- **Consultar historial de compras**: Listar las órdenes generadas y acceder a las claves de activación (`DigitalKey`) una vez que la orden fue pagada y las claves ya fueron asignadas.
- **Reseñar videojuego**: Calificar con puntaje y texto un videojuego, siempre y cuando se verifique la compra previa del mismo.

## 2. Actor: Vendedor (Seller)

- **Gestionar catálogo propio**: Crear, editar y actualizar productos asociados a su cuenta de vendedor.
- **Administrar stock digital**: Cargar claves digitales para productos específicos y revisar el stock disponible de sus publicaciones.
- **Consultar ventas y transacciones**: Ver órdenes, claves asignadas y transacciones de escrow asociadas a sus productos.

## 3. Actor: Administrador (Admin)

- **Gestionar catálogo global**: Crear, editar, cambiar estados de publicación y eliminar productos del inventario.
- **Carga de claves digitales**: Agregar stock de claves seriales para videojuegos específicos mediante carga individual o masiva.
- **Gestión administrativa de órdenes**: Marcar órdenes como pagadas, asignar claves, crear la transacción de escrow y mutar estados logísticos a `PROCESSING`, `SHIPPED`, `DELIVERED` o `CANCELLED`.
- **Aprobación de escrow**: Aprobar o rechazar transacciones para liberar o retener fondos.
- **Métricas del dashboard**: Obtener estadísticas globales como facturación total, productos más populares y cantidad de usuarios activos.
