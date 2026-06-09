# Casos de Uso del Sistema

La API REST del backend está estructurada en base a los siguientes casos de uso principales clasificados según los actores del sistema:

## 1. Actor: Comprador (Usuario Autenticado)

- **Registrar Cuenta**: Crear un perfil de usuario con contraseña cifrada y envío de correo de confirmación.
- **Gestionar Carrito de Compras**: Añadir, modificar cantidades o eliminar videojuegos digitales en su carrito persistente en base de datos.
- **Crear Orden de Compra (Checkout)**: Generar una orden en estado `PENDING` consolidando los precios actuales de los videojuegos e inhabilitando temporalmente el stock de claves requeridas.
- **Aplicar Cupón de Descuento**: Validar la fecha y estado de un cupón para aplicar una reducción porcentual en el monto total de la orden.
- **Consultar Historial de Compras**: Listar las órdenes generadas y acceder a las claves de activación (`DigitalKeys`) una vez que el pago de la orden ha sido aprobado.
- **Reseñar Videojuego**: Calificar con puntaje y texto un videojuego, siempre y cuando se verifique la compra previa del mismo.

## 2. Actor: Administrador (Admin)

- **Gestionar Catálogo (ABM)**: Crear, editar, cambiar estados de publicación y eliminar videojuegos del inventario de productos.
- **Carga de Claves Digitales**: Agregar stock de claves seriales para videojuegos específicos mediante carga individual o masiva.
- **Gestión Administrativa de Órdenes**: Consultar el listado global de transacciones, ver detalles de compra y modificar manualmente los estados de las órdenes (ej. aprobar órdenes pendientes).
- **Métricas del Dashboard**: Obtener estadísticas globales como facturación total, productos más populares y cantidad de usuarios activos.
