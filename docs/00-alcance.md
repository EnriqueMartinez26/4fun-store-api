# Alcance del Proyecto

Este proyecto backend forma parte de la tesis académica para la carrera de Tecnicatura en Programación. Su objetivo es demostrar el análisis, diseño e implementación de una API REST sólida, aplicando buenas prácticas de desarrollo y patrones de diseño modernos.

## Definición del Alcance

El sistema está diseñado específicamente como un **e-commerce de videojuegos digitales**. Esto implica que no existe manejo ni logística de inventario físico (envíos, depósitos o paquetes físicos). La entrega del producto se realiza 100% en formato digital.

### Incluido en el Alcance

1. **Gestión de cuentas de usuario**:
   - Registro de usuarios con validaciones de campos.
   - Autenticación segura y persistencia de sesión a través de JSON Web Tokens (JWT) almacenados en cookies HttpOnly.
   - Roles definidos: Comprador (`BUYER`), Vendedor (`SELLER`) y Administrador (`ADMIN`).
   - Verificación de correo electrónico para activación de cuenta.

2. **Catálogo digital**:
   - Clasificación jerárquica de videojuegos por plataformas y géneros.
   - Filtrado dinámico y paginación desde el backend.

3. **Operaciones de carrito y compras**:
   - Gestión de carrito de compras persistente.
   - Creación de órdenes de compra con estados logísticos asociados (`PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`).
   - Consolidación del total desde los datos normalizados del pedido y separación del estado financiero mediante `isPaid` y `Transaction`.

4. **Entrega de claves digitales**:
   - Lógica de asignación atómica de licencias (`DigitalKey`) a las órdenes pagadas.

5. **Panel de control administrativo (Dashboard)**:
   - Panel de control para usuarios con rol `ADMIN` para gestionar disponibilidad de claves, ver estadísticas del sistema y administrar usuarios.
   - Panel secundario para vendedores con acceso a sus propios productos, ventas y transacciones.

### Fuera del Alcance

1. **Procesamiento de dinero real**:
   - No se procesan transacciones bancarias reales ni cobros monetarios productivos. Toda la pasarela de pagos funciona en base a simulaciones controladas (sandbox).
2. **Logística física**:
   - Distribución de discos físicos, carátulas o paquetes.
3. **Facturación impositiva legal**:
   - Emisión de facturas válidas ante organismos gubernamentales.
