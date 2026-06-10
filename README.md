# 4Fun Store API

API REST para un sistema e-commerce académico orientado a la venta de videojuegos digitales. El proyecto implementa gestión de usuarios, autenticación, catálogo de productos, carrito, órdenes de compra, entrega de claves digitales y administración de transacciones bajo un flujo de aprobación.

## Alcance del proyecto

Este backend forma parte de un proyecto de tesis de Tecnicatura en Programación. Su objetivo es demostrar el análisis, diseño e implementación de un sistema web con reglas de negocio reales, persistencia relacional, seguridad básica, separación por capas y trazabilidad de operaciones.

El sistema se enfoca exclusivamente en videojuegos digitales. La entrega del producto se modela mediante claves digitales asociadas a órdenes pagadas.

### Funcionalidades principales
- Registro e inicio de sesión de usuarios.
- Autenticación mediante JWT y cookies HttpOnly.
- Roles de usuario: comprador, vendedor y administrador.
- Gestión de catálogo de videojuegos digitales.
- Clasificación por plataforma y género.
- Carrito de compras persistente.
- Creación de órdenes de compra.
- Asignación de claves digitales a órdenes pagadas.
- Gestión administrativa de productos, órdenes y usuarios.
- Sistema de transacciones con aprobación administrativa.
- Validaciones de negocio y manejo centralizado de errores.
- Registro de eventos mediante logging.

## Arquitectura

El backend utiliza una arquitectura MVC + Services:

- **Routes**: definen los endpoints HTTP.
- **Middlewares**: aplican autenticación, autorización, validaciones y manejo transversal.
- **Controllers**: reciben la request y delegan la lógica.
- **Services**: concentran reglas de negocio.
- **Prisma**: gestiona el acceso a PostgreSQL.
- **Utils**: contiene utilidades compartidas como logger y errores personalizados.

Flujo general:
`Request → Route → Middleware → Controller → Service → Prisma → PostgreSQL`

## Tecnologías
- Node.js
- Express
- PostgreSQL
- Prisma ORM
- JWT
- bcrypt
- Helmet
- CORS
- express-rate-limit
- Winston
- Jest

## Modelo de dominio

Entidades principales:
- User
- SellerProfile
- Product
- Platform
- Genre
- Cart
- CartItem
- Order
- OrderItem
- DigitalKey
- Transaction
- Coupon
- Review

## Flujo principal
1. El usuario se registra.
2. El usuario inicia sesión.
3. El usuario explora el catálogo.
4. El usuario agrega productos digitales al carrito.
5. El usuario crea una orden.
6. El administrador marca la orden como pagada.
7. El sistema asigna claves digitales disponibles.
8. El sistema crea una transacción pendiente de aprobación.
9. El administrador aprueba o rechaza la transacción.

## Variables de entorno

Copiar `.env.example` como `.env` y completar los valores requeridos.

Variables principales:
```env
PORT=9003
NODE_ENV=development
FRONTEND_URL=http://localhost:9002
BACKEND_URL=http://localhost:9003
DATABASE_URL=
JWT_SECRET=
JWT_EXPIRE=7d
JWT_COOKIE_EXPIRE=30
SMTP_EMAIL=
SMTP_PASSWORD=
CONTACT_ADMIN_EMAIL=
LOG_LEVEL=info
```

## Instalación
```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

El servidor queda disponible en:
`http://localhost:9003`

## Pruebas
```bash
npm test
```

Las pruebas cubren casos críticos del sistema, incluyendo autenticación, órdenes, claves digitales, permisos y transacciones.

## Limitaciones académicas
- El sistema no procesa dinero real.
- El flujo de pago se modela para demostrar el ciclo de orden y aprobación.
- El sistema se enfoca únicamente en productos digitales.
- La aprobación de transacciones representa una regla administrativa interna, no una transferencia bancaria real.
- Las credenciales reales deben gestionarse fuera del repositorio.

## Mejoras futuras
- Integración completa con una pasarela de pagos.
- Panel de métricas avanzado.
- Mayor cobertura de pruebas automatizadas.
- Auditoría financiera externa.
- Optimización de consultas y carga.
- Separación en servicios independientes si el sistema escala.

## Estado académico final

Este repositorio contiene la versión final entregable de la tesis 4Fun Store.  
La rama `main` representa el estado final consolidado, mientras que la rama `tesis/flujo-principal` conserva la trazabilidad del cierre funcional y del despliegue académico.

Release final: `v1.0.0-thesis`.

