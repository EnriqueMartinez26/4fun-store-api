# Alcance del Proyecto

Este proyecto backend forma parte de la tesis académica para la carrera de Tecnicatura en Programación. Su objetivo es demostrar el análisis, diseño e implementación de una API REST sólida, aplicando buenas prácticas de desarrollo y patrones de diseño modernos.

## Definición del Alcance

El sistema está diseñado específicamente como un **e-commerce de videojuegos digitales**. Esto implica que no existe manejo ni logística de inventario físico (envíos, depósitos o paquetes físicos). La entrega del producto se realiza 100% en formato digital.

### Incluido en el Alcance

1. **Gestión de Cuentas de Usuario**:
   - Registro de usuarios con validaciones de campos.
   - Autenticación segura y persistencia de sesión a través de JSON Web Tokens (JWT) almacenados en cookies HttpOnly.
   - Roles definidos: Comprador (`USER`) y Administrador (`ADMIN`).
   - Verificación de correo electrónico para activación de cuenta.

2. **Catálogo Digital**:
   - Clasificación jerárquica de videojuegos por plataformas y géneros.
   - Filtrado dinámico y paginación desde el backend.

3. **Operaciones de Carrito y Compras**:
   - Gestión de carrito de compras persistente.
   - Creación de órdenes de compra con estados asociados (`PENDING`, `COMPLETED`, `CANCELLED`).
   - Aplicación de cupones de descuento vigentes y no acumulables.

4. **Entrega de Claves Digitales**:
   - Lógica de asignación atómica de licencias (`DigitalKeys`) a las órdenes completadas.

5. **Panel de Control Administrativo (Dashboard)**:
   - Panel de control para usuarios con rol `ADMIN` para gestionar stock, ver estadísticas del sistema y administrar usuarios.

### Fuera del Alcance

1. **Procesamiento de Dinero Real**:
   - No se procesan transacciones bancarias reales ni cobros monetarios productivos. Toda la pasarela de pagos funciona en base a simulaciones controladas (sandbox).
2. **Logística Física**:
   - Distribución de discos físicos, carátulas o paquetes.
3. **Facturación Impositiva Legal**:
   - Emisión de facturas válidas ante organismos gubernamentales.
