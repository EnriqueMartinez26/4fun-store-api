/**
 * Utilidades para totales de órdenes.
 * --------------------------------------------------------------------------
 * Centraliza el cálculo de importes derivados para evitar persistir datos
 * redundantes en la base de datos. La fuente de verdad es siempre el detalle
 * de ítems + shippingPrice.
 */

const toNumber = (value) => {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
};

const calculateOrderItemsTotal = (orderItems = []) => {
    if (!Array.isArray(orderItems)) return 0;

    return orderItems.reduce((sum, item) => {
        const unitPrice = toNumber(item?.unitPriceAtPurchase ?? item?.unit_price ?? item?.price);
        const quantity = toNumber(item?.quantity);
        return sum + (unitPrice * quantity);
    }, 0);
};

const calculateOrderTotal = (order = {}) => {
    return Number((toNumber(order?.shippingPrice) + calculateOrderItemsTotal(order?.orderItems)).toFixed(2));
};

const attachOrderTotal = (order) => {
    if (!order) return order;

    const hasLineItems = Array.isArray(order.orderItems) && order.orderItems.length > 0;
    const totalPrice = hasLineItems
        ? calculateOrderTotal(order)
        : toNumber(order.totalPrice ?? order.total ?? order.shippingPrice);

    return {
        ...order,
        totalPrice
    };
};

module.exports = {
    toNumber,
    calculateOrderItemsTotal,
    calculateOrderTotal,
    attachOrderTotal
};
