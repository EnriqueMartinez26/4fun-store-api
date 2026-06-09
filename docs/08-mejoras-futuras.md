# Mejoras Futuras

Para evolucionar el backend de **4Fun Store** más allá del alcance académico actual, se proponen las siguientes líneas de trabajo y optimizaciones a futuro:

## Propuestas de Evolución

1. **Integración Productiva de Pasarelas**:
   - Cerrar el ciclo comercial conectando pasarelas de pago reales y certificadas mediante webhooks robustos para procesamiento de dinero fiduciario o criptoactivos.

2. **Cifrado de Licencias**:
   - Implementar criptografía asimétrica sobre las claves digitales en la base de datos, asegurando que solo sean legibles por el usuario comprador mediante su clave privada o token efímero de descarga.

3. **Arquitectura Orientada a Eventos**:
   - Separar el servicio de generación de órdenes y de despacho de claves a través de un bróker de mensajería (ej. RabbitMQ o Redis Pub/Sub) para evitar colisiones de stock y condiciones de carrera bajo alta concurrencia.

4. **Monitoreo y Métricas Avanzadas**:
   - Integrar herramientas de telemetría y monitoreo de rendimiento como Prometheus y Grafana para supervisar la API, base de datos y latencias de respuesta en producción.

5. **Mayor Cobertura de Testing**:
   - Extender la cobertura de pruebas unitarias hacia el 100% de los servicios e incorporar pruebas de integración E2E (End-to-End) simulando flujos de usuario completos.
