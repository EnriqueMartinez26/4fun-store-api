# Arquitectura del Sistema

El backend de **4Fun Store** está implementado sobre una arquitectura organizada en capas bien definidas bajo el patrón **MVC (Model-View-Controller) + Services**. Esta separación de responsabilidades facilita el mantenimiento, la escalabilidad y las pruebas unitarias.

## Capas del Backend

```
Request → [Routes] → [Middlewares] → [Controllers] → [Services] → [Prisma ORM] → Database (PostgreSQL)
```

1. **Routes (Rutas)**:
   - Define los puntos de entrada HTTP expuestos por la API REST.
   - Mapea los verbos HTTP (GET, POST, PUT, DELETE) hacia sus respectivos controladores.

2. **Middlewares (Interceptores)**:
   - Manejan tareas transversales (cross-cutting concerns) como:
     - Autenticación y validación de tokens JWT (`auth.middleware.ts`).
     - Control de permisos basados en roles.
     - Validaciones sintácticas de entrada de datos (`express-validator`).
     - Manejo centralizado de errores y excepciones del sistema.

3. **Controllers (Controladores)**:
   - Reciben los datos de la request HTTP (parámetros, query, body).
   - Delegan toda la lógica y cómputo de negocio a la capa de servicios.
   - Estructuran y envían la response HTTP adecuada (códigos de estado e información en formato JSON).

4. **Services (Servicios)**:
   - Concentran e implementan la lógica de negocio y las validaciones complejas.
   - Son agnósticos de la capa de transporte HTTP, facilitando su reutilización y testing.

5. **Prisma ORM (Persistencia)**:
   - Actúa como enlace relacional de datos entre los servicios y la base de datos PostgreSQL.
   - Garantiza la integridad referencial y provee tipado estático en tiempo de desarrollo.

6. **Utils**:
   - Módulos transversales que exponen utilidades de formateo, constantes, logger global (`Winston`) y constructores de excepciones personalizados.
