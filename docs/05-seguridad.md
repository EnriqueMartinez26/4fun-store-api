# Seguridad del Backend

Se implementaron múltiples medidas y tecnologías transversales para resguardar la API y la información del sistema:

## Mecanismos Implementados

1. **Cifrado de Contraseñas**:
   - Almacenamiento seguro de passwords en la base de datos aplicando algoritmos de hash unidireccional con sal (`bcryptjs`).

2. **Autenticación mediante JWT en Cookies HttpOnly**:
   - Los JSON Web Tokens (JWT) no se almacenan en LocalStorage para evitar ataques de Cross-Site Scripting (XSS).
   - Se inyectan mediante cabecera `Set-Cookie` con las siguientes directivas de seguridad:
     - `httpOnly: true` (impide acceso al token desde JavaScript en el navegador).
     - `secure: process.env.NODE_ENV === 'production'` (transporte cifrado forzado solo bajo HTTPS en entornos productivos).
     - `sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax'` (manejo adecuado para CORS y peticiones cross-site).

3. **Cabeceras HTTP Seguras (Helmet)**:
   - Configuración automatizada de cabeceras HTTP de seguridad básicas para mitigar ataques como Clickjacking, MIME-sniffing y cross-site scripting.

4. **Prevención contra DDoS y Fuerza Bruta (Rate Limiting)**:
   - Restricción del flujo de peticiones a un máximo de 1000 requests cada 15 minutos por dirección IP en todos los endpoints de la API.

5. **Protección contra Inyección SQL**:
   - Uso obligatorio de las API tipadas de Prisma ORM, que parametrizan y sanean las consultas SQL de forma nativa.

6. **Sanitización de Datos y Parámetros**:
   - Uso de `middlewares/authValidator.js` con `express-validator` para forzar esquemas y sanear cuerpos de peticiones en las rutas.
   - Uso de middleware `hpp` para prevenir ataques de contaminación de parámetros HTTP (Parameter Pollution).

7. **Aislamiento de Herramientas de Diagnóstico**:
   - El endpoint de diagnóstico `/debug/smtp` está restringido estrictamente para entornos no productivos (`NODE_ENV !== 'production'`). Adicionalmente, cualquier credencial o secreto impreso en la response es enmascarado para evitar filtración accidental de contraseñas.
