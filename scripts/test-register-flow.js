const http = require('http');
const prisma = require('../lib/prisma');

const payload = JSON.stringify({
  name: 'Nuevo Comprador',
  email: 'newbuyer@4fun.test',
  password: 'password123'
});

console.log('[INFO] Iniciando prueba de registro de usuario nuevo.');

// 1. POST /api/auth/register
const registerReq = http.request(
  {
    hostname: 'localhost',
    port: 9003,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', async () => {
      console.log(`\nRegister Status Code: ${res.statusCode}`);
      
      // Validación estricta y case-insensitive contra filtración de contraseñas
      if (data.toLowerCase().includes('password')) {
        console.error('[ERROR] La respuesta de registro expone el campo password.');
        await cleanup();
        process.exit(1);
      }

      let bodyJson;
      try {
        bodyJson = JSON.parse(data);
      } catch {
        console.error(`[ERROR] La respuesta de registro no es JSON válido: ${data}`);
        await cleanup();
        process.exit(1);
      }

      if (bodyJson.token) {
        bodyJson.token = '<JWT_REDACTED>';
      }
      if (bodyJson.user) {
        bodyJson.user = {
          email: bodyJson.user.email,
          role: bodyJson.user.role,
          isVerified: bodyJson.user.isVerified
        };
      }
      console.log(`Register Body:\n${JSON.stringify(bodyJson, null, 2)}`);

      if (res.statusCode !== 201 && res.statusCode !== 200) {
        console.error('[ERROR] Registro fallido.');
        await cleanup();
        process.exit(1);
      }

      console.log('\n[INFO] Consultando token de verificación en base de datos...');
      try {
        const userInDb = await prisma.user.findUnique({
          where: { email: 'newbuyer@4fun.test' }
        });

        if (!userInDb) {
          console.error('[ERROR] El usuario no fue guardado en base de datos.');
          await cleanup();
          process.exit(1);
        }

        // Aserciones obligatorias: rol BUYER y no verificado inicialmente
        if (userInDb.role !== 'BUYER') {
          console.error(`[ERROR] Rol inesperado: ${userInDb.role}`);
          await cleanup();
          process.exit(1);
        }
        if (userInDb.isVerified !== false) {
          console.error('[ERROR] El usuario debería arrancar con isVerified: false');
          await cleanup();
          process.exit(1);
        }

        console.log(`[OK] Usuario encontrado en BD. Rol: ${userInDb.role}. isVerified: ${userInDb.isVerified}.`);
        console.log('[OK] Token de verificación obtenido de la base de datos. Valor omitido por seguridad.');

        const token = userInDb.verificationToken;

        // 2. GET /api/auth/verify-email?token=...
        console.log('\n[INFO] Iniciando verificación de email.');
        const verifyReq = http.request(
          {
            hostname: 'localhost',
            port: 9003,
            path: `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
            method: 'GET'
          },
          (resVerify) => {
            let dataVerify = '';
            resVerify.on('data', chunk => { dataVerify += chunk; });
            resVerify.on('end', async () => {
              console.log(`\nVerify Status Code: ${resVerify.statusCode}`);

              let verifyJson;
              try {
                verifyJson = JSON.parse(dataVerify);
              } catch {
                console.error(`[ERROR] La respuesta de verificación no es JSON válido: ${dataVerify}`);
                await cleanup();
                process.exit(1);
              }

              console.log(`Verify Body:\n${JSON.stringify(verifyJson, null, 2)}`);

              if (resVerify.statusCode !== 200) {
                console.error('[ERROR] La verificación de email no respondió 200.');
                await cleanup();
                process.exit(1);
              }

              if (verifyJson.success !== true) {
                console.error('[ERROR] La verificación de email no devolvió success=true.');
                await cleanup();
                process.exit(1);
              }

              // Reconsultar BD después de verificar
              const userAfterVerify = await prisma.user.findUnique({
                where: { email: 'newbuyer@4fun.test' }
              });

              if (!userAfterVerify) {
                console.error('[ERROR] El usuario no existe después de verificar.');
                await cleanup();
                process.exit(1);
              }

              if (userAfterVerify.isVerified !== true) {
                console.error('[ERROR] El usuario no quedó verificado en base de datos.');
                await cleanup();
                process.exit(1);
              }

              console.log(`[OK] Usuario verificado en BD. isVerified: ${userAfterVerify.isVerified}.`);

              // 3. POST /api/auth/login con el nuevo usuario verificado
              console.log('\n[INFO] Iniciando prueba de login con el usuario nuevo verificado.');
              const loginPayload = JSON.stringify({
                email: 'newbuyer@4fun.test',
                password: 'password123'
              });

              const loginReq = http.request(
                {
                  hostname: 'localhost',
                  port: 9003,
                  path: '/api/auth/login',
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(loginPayload)
                  }
                },
                (resLogin) => {
                  let dataLogin = '';
                  resLogin.on('data', chunk => { dataLogin += chunk; });
                  resLogin.on('end', async () => {
                    console.log(`\nLogin Status Code: ${resLogin.statusCode}`);
                    
                    // Validación estricta y case-insensitive contra filtración de contraseñas en login
                    if (dataLogin.toLowerCase().includes('password')) {
                      console.error('[ERROR] La respuesta de login expone el campo password.');
                      await cleanup();
                      process.exit(1);
                    }

                    let loginJson;
                    try {
                      loginJson = JSON.parse(dataLogin);
                    } catch {
                      console.error(`[ERROR] La respuesta de login no es JSON válido: ${dataLogin}`);
                      await cleanup();
                      process.exit(1);
                    }

                    if (loginJson.token) {
                      loginJson.token = '<JWT_REDACTED>';
                    }
                    if (loginJson.user) {
                      loginJson.user = {
                        email: loginJson.user.email,
                        role: loginJson.user.role,
                        isVerified: loginJson.user.isVerified
                      };
                    }
                    console.log(`Login Body:\n${JSON.stringify(loginJson, null, 2)}`);

                    if (resLogin.statusCode === 200 && loginJson.success && loginJson.user.isVerified) {
                      console.log('\n[OK] El nuevo usuario inició sesión correctamente tras verificar su email.');
                      await cleanup();
                      process.exit(0);
                    } else {
                      console.error('[ERROR] No se pudo iniciar sesión con el nuevo usuario o no figura como verificado.');
                      await cleanup();
                      process.exit(1);
                    }
                  });
                }
              );
              loginReq.write(loginPayload);
              loginReq.end();
            });
          }
        );
        verifyReq.end();
      } catch (err) {
        console.error(`[ERROR] Excepción durante la validación: ${err.message}`);
        await cleanup();
        process.exit(1);
      }
    });
  }
);

async function cleanup() {
  console.log('\n[INFO] Realizando limpieza de datos de prueba.');
  try {
    const user = await prisma.user.findUnique({ where: { email: 'newbuyer@4fun.test' } });
    if (user) {
      await prisma.cartItem.deleteMany({ where: { cart: { userId: user.id } } });
      await prisma.cart.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      console.log('[OK] Limpieza completada con éxito.');
    }
  } catch (err) {
    console.error(`[ERROR] No se pudo limpiar el usuario de pruebas: ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

registerReq.on('error', async (err) => {
  console.error(`[ERROR] Error en petición de registro: ${err.message}`);
  await cleanup();
  process.exit(1);
});

registerReq.write(payload);
registerReq.end();
