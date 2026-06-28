/**
 * Patrón GoF: Strategy — ConcreteStrategy para Productos Digitales
 * --------------------------------------------------------------------------
 * Implementa el contrato `PricingStrategy` para la familia de productos
 * digitales (juegos, software, licencias). Esta clase es el segundo
 * **ConcreteStrategy** (GoF §Strategy - Participant) de la jerarquía de
 * estrategias de precios.
 *
 * Consecuencia GoF §Strategy — Beneficio de EXTENSIBILIDAD:
 *   "Strategies eliminate conditional statements. Without strategies, code for
 *    selecting the desired behavior is peppered with conditional statements.
 *    Encapsulating the behavior in separate Strategy classes eliminates these
 *    conditional statements." (Design Patterns, GoF §5 — Strategy)
 * → El if/else que existía en productToDTO() (tipo === 'Digital' ? ... : ...)
 *   ha sido eliminado y encapsulado aquí, sin efectos en el contexto.
 *
 * RN (Regla de Negocio — Productos Digitales):
 *   El stock real se deriva del conteo dinámico de DigitalKeys con estado
 *   'AVAILABLE' para ese producto en la BD.
 */

const PricingStrategy = require('./PricingStrategy');

class DigitalProductStrategy extends PricingStrategy {
    /**
     * Calcula el precio final de un producto digital. La lógica de descuento
     * es idéntica a la del producto físico (la variación futura podría ser
     * descuentos por suscripción, licencias por volumen, etc.).
     *
     * @override Polimorfismo — Especializa el cálculo base para productos digitales.
     * @param {object} p - Entidad cruda de Prisma (producto).
     * @returns {{ finalPrice: number, discountPercentage: number }}
     */
    calculatePrice(p) {
        // RN — Promociones: Un descuento solo es válido si el % > 0 y no ha expirado.
        const discountActive = p.discountPercent > 0 &&
            (!p.discountEndDate || new Date(p.discountEndDate) > new Date());

        const discountPercentage = discountActive ? p.discountPercent : 0;

        // RN — Precisión Financiera: El precio final aplica el factor de descuento.
        const finalPrice = discountActive
            ? Number((Number(p.price) * (1 - p.discountPercent / 100)).toFixed(2))
            : Number(p.price);

        return { finalPrice, discountPercentage };
    }

    /**
     * Para productos digitales, el stock disponible es el conteo de
     * DigitalKeys con estado 'AVAILABLE' (_count.digitalKeys).
     *
     * RN (Disponibilidad Digital): Si `_count` no está disponible (consulta sin
     * include), se hace fallback al listado de keys cargado en memoria.
     *
     * @override Polimorfismo — Lee stock del conteo de keys en la relación.
     * @param {object} p - Entidad cruda de Prisma (producto).
     * @returns {number} Cantidad de keys disponibles para entrega inmediata.
     */
    calculateStock(p) {
        // RN (Integridad Digital): La fuente primaria es el conteo relacional de Keys.
        return p._count?.digitalKeys ?? (p.digitalKeys?.filter((key) => key.status === 'AVAILABLE').length ?? 0);
    }
}

module.exports = new DigitalProductStrategy();
