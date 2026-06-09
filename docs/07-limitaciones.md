# Limitaciones del Proyecto

Al tratarse de un desarrollo enfocado en el ámbito académico y de tesis, el backend de **4Fun Store** reconoce y delimita las siguientes limitaciones técnicas y operacionales:

## Limitaciones Técnicas y de Negocio

1. **Simulación del Flujo de Pagos (Sandbox)**:
   - Las órdenes cambian de estado mediante simulación o utilizando el entorno sandbox de MercadoPago. No se efectúan cobros monetarios reales, ni se cuenta con contratos reales de cuentas de vendedor productivas.

2. **Almacenamiento de Claves en Texto Plano**:
   - Las claves digitales (`DigitalKeys`) se persisten en texto plano en la base de datos PostgreSQL. En un escenario comercial real, este stock de licencias requeriría mecanismos de encriptación asimétrica y control riguroso de accesos de base de datos.

3. **Autenticación sin OAuth**:
   - La autenticación depende puramente del registro interno mediante email y contraseña de la base de datos local. No se integran proveedores de identidad federados externos (como Login con Google, Apple o Steam).

4. **Escalabilidad de Monolito**:
   - El sistema está estructurado como una única aplicación monolítica Express. Ante demandas masivas concurrentes, requeriría migración de componentes críticos (como la asignación de claves) hacia servicios o funciones independientes basadas en colas de mensajes.
