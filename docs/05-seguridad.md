# Seguridad del Backend

Se implementaron múltiples medidas y tecnologías transversales para resguardar la API y la información del sistema:

## Mecanismos Implementados

1. **Cifrado de Contraseñas**:
   - Almacenamiento seguro de passwords en la base de datos aplicando algoritmos de hash unidireccional con sal (`bcryptjs`).

2. **Autenticación mediante JWT en Cookies HttpOnly**:
   - Los JSON Web Tokens (JWT) no se devuelven en el cuerpo del JSON ni se guardan en el LocalStorage del cliente. Se inyectan en cookies con flags `httpOnly` y `secure` (en producción), mitigando ataques de Cross-Site Scripting (XSS).

3. **Cabeceras HTTP Seguras (Helmet)**:
   - Configuración automatizada de cabeceras HTTP de seguridad básicas para mitigar ataques como Clickjacking, MIME-sniffing y cross-site scripting.

4. **Prevención contra DDoS y Fuerza Bruta (Rate Limiting)**:
   - Restricción del flujo de peticiones a un máximo de 1000 requests cada 15 minutos por dirección IP en todos los endpoints de la API.

5. **Protección contra Inyección SQL**:
   - Uso obligatorio de las API tipadas de Prisma ORM, que parametrizan y sanean las consultas SQL de forma nativa.

6. **Sanitización de Datos y Parámetros**:
   - Uso de `express-validator` para forzar esquemas y sanean cuerpos de peticiones en las rutas.
   - Uso de middleware `hpp` para prevenir ataques de contaminación de parámetros HTTP (Parameter Pollution).
