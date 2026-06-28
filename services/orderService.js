/**
 * Capa de Servicios: Facturación y Órdenes Core
 * --------------------------------------------------------------------------
 * Eje principal del flujo financiero (Checkout Pipeline). Abstrae complejas
 * inserciones multifamiliares y control cruzado lógico de base de datos.
 *
 * Patrón GoF: Observer — Integración del Subject
 * --------------------------------------------------------------------------
 * Este servicio actúa como productor de eventos (Subject indirecto).
 * Al completarse un pago, no llama directamente a EmailService ni a ningún
 * otro canal de notificación. En su lugar, emite un evento al `OrderEventBus`
 * (Subject GoF), quien distribuye la notificación a todos los observers
 * suscritos (Email, Auditoría, SMS futuro, etc.).
 *
 * Consecuencia GoF §Observer — FLEXIBILIDAD:
 *   "The subject doesn't know how many objects depend on it. Adding new
 *    notification channels (SMS, Push) requires zero changes to this service."
 *   (Design Patterns, GoF §5 — Observer: Consequences)
 */

const prisma          = require('../lib/prisma');
const orderEventBus   = require('./observers/OrderEventBus');
const ProductComponentFactory = require('./composite/ProductComponentFactory');
const { attachOrderTotal, calculateOrderTotal } = require('../utils/orderTotals');
const { DEFAULT_IMAGE } = require('../utils/constants');
const logger          = require('../utils/logger');
const ErrorResponse   = require('../utils/errorResponse');

const allowedPaymentMethods = new Set(['MERCADOPAGO', 'TRANSFER', 'CASH']);
const allowedOrderStatuses = new Set(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']);

const normalizePaymentMethod = (paymentMethod) => {
    const normalized = paymentMethod ? String(paymentMethod).trim().toUpperCase() : 'MERCADOPAGO';
    if (!allowedPaymentMethods.has(normalized)) {
        throw new ErrorResponse(`Método de pago inválido: ${paymentMethod}`, 400);
    }
    return normalized;
};

const normalizeShippingAddress = (shippingAddress) => {
    if (shippingAddress === undefined || shippingAddress === null) return undefined;
    if (typeof shippingAddress !== 'object' || Array.isArray(shippingAddress)) {
        throw new ErrorResponse('La dirección de envío debe ser un objeto válido', 400);
    }

    const normalizeRequired = (value, field) => {
        const normalized = typeof value === 'string' ? value.trim() : '';
        if (!normalized) {
            throw new ErrorResponse(`shippingAddress.${field} es requerido`, 400);
        }
        return normalized;
    };

    return {
        fullName: normalizeRequired(shippingAddress.fullName, 'fullName'),
        street: normalizeRequired(shippingAddress.street, 'street'),
        city: normalizeRequired(shippingAddress.city, 'city'),
        state: typeof shippingAddress.state === 'string' && shippingAddress.state.trim()
            ? shippingAddress.state.trim()
            : null,
        zip: normalizeRequired(shippingAddress.zip, 'zip'),
        country: normalizeRequired(shippingAddress.country, 'country')
    };
};

class OrderService {

    /**
     * Consolidación Inicial: Chequea inventarios y forja un ticket "Pendiente".
     * RN (Regla de Atomicidad): Intercepta fallos aislados en reservaciones de claves mediante
     * heurísticas de compensación manual (Rollback) simuladas.
     */
    async createOrder({ user, orderItems, shippingAddress, paymentMethod }) {
        if (!orderItems?.length) throw new ErrorResponse('El carrito está vacío.', 400);

        const backendUrl = process.env.BACKEND_URL;
        if (!backendUrl) throw new ErrorResponse('BACKEND_URL no está configurado.', 500);

        const validatedItems = [];
        const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
        const normalizedShippingAddress = normalizeShippingAddress(shippingAddress);

        // RN (Seguridad de Precios): El frontend manda la intención, el Service reconstruye el ticket
        // cotizando con valores limpios atados en la Base de Datos para evitar Inyección de Precios.
        for (const [index, item] of orderItems.entries()) {
            if (!item || typeof item !== 'object') {
                throw new ErrorResponse(`orderItems[${index}] debe ser un objeto válido`, 400);
            }

            const productId = typeof item.product === 'string' ? item.product.trim() : '';
            if (!productId) {
                throw new ErrorResponse(`orderItems[${index}].product es obligatorio`, 400);
            }

            const quantity = Number(item.quantity);
            if (!Number.isInteger(quantity) || quantity < 1) {
                throw new ErrorResponse(`orderItems[${index}].quantity debe ser un entero mayor o igual a 1`, 400);
            }

            const product = await prisma.product.findUnique({ where: { id: productId } });
            if (!product) throw new ErrorResponse(`Producto no encontrado: ${productId}`, 400);

            if (product.status !== 'ACTIVE') {
                throw new ErrorResponse(`Este producto ya no está disponible: ${product.name}`, 400);
            }

            // RN de Disponibilidad por Tipología: el schema actual solo admite digital.
            if (product.type === 'DIGITAL') {
                const availableKeys = await prisma.digitalKey.count({
                    where: { productId, status: 'AVAILABLE' }
                });
                if (availableKeys < quantity) {
                    throw new ErrorResponse(`Stock insuficiente de keys para: ${product.name} (Disponibles: ${availableKeys})`, 400);
                }
            }

            const component = ProductComponentFactory.create(product);
            const componentPrice = component.getPrice();

            validatedItems.push({
                productId,
                quantity,
                unitPriceAtPurchase: componentPrice // Precio calculado vía polimorfismo
            });
        }

        // RN (Regla de Atomicidad): Usamos $transaction para que la creación del pedido
        // y la reserva de claves sean una sola operación indivisible.
        const order = await prisma.$transaction(async (tx) => {
            // 1. Crear la orden y sus items
            return await tx.order.create({
                data: {
                    userId: user.id || user._id?.toString() || user,
                    paymentMethod: normalizedPaymentMethod,
                    shippingPrice: 0,
                    status: 'PENDING',
                    isPaid: false,
                    shippingAddress: normalizedShippingAddress ? { create: normalizedShippingAddress } : undefined,
                    orderItems: {
                        create: validatedItems
                    }
                },
                include: {
                    orderItems: true,
                    shippingAddress: true
                }
            });
        });

        logger.info(`Orden ${order.id} creada exitosamente (Pendiente de pago).`);
        return { 
            orderId: order.id, 
            paymentLink: 'https://link.mercadopago.com.ar/4funstore', 
            order: attachOrderTotal({ ...order, _id: order.id }) 
        };
    }

    async getUserOrders(userId, { page = 1, limit = 5 } = {}) {
        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Number(limit));

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                include: { 
                    orderItems: { include: { product: true } }, 
                    shippingAddress: true, 
                    digitalKeys: { select: { id: true, key: true, productId: true } } 
                },
                skip: (pageNum - 1) * limitNum,
                take: limitNum
            }),
            prisma.order.count({ where: { userId } })
        ]);

        const ordersWithTotals = orders.map(order => attachOrderTotal(order));

        return {
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            orders: ordersWithTotals.map(o => ({
                ...o,
                _id: o.id,
                orderItems: (o.orderItems || []).map(i => ({ 
                    ...i, 
                    _id: i.id, 
                    price: Number(i.unitPriceAtPurchase), 
                    name: i.product?.name || 'Producto Desconocido', 
                    image: i.product?.imageUrl || DEFAULT_IMAGE 
                }))
            }))
        };
    }

    async getOrderById(orderId, userId, userRole) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { 
                user: { select: { id: true, name: true, email: true } }, 
                orderItems: { include: { product: true } }, 
                shippingAddress: true,
                digitalKeys: { select: { id: true, key: true, productId: true } }
            }
        });
        
        if (!order) throw new ErrorResponse('Orden no encontrada', 404);
        
        // RN Permisos (Tenencia): Inquisita pertenencia local vs rol piramidal.
        if (order.userId !== userId && userRole !== 'ADMIN') throw new ErrorResponse('No autorizado para ver esta orden', 403);
        
        return { 
            ...attachOrderTotal(order), 
            _id: order.id,
            orderItems: (order.orderItems || []).map(i => ({ 
                ...i, 
                _id: i.id, 
                price: Number(i.unitPriceAtPurchase), 
                name: i.product?.name || 'Producto Desconocido', 
                image: i.product?.imageUrl || DEFAULT_IMAGE 
            }))
        };
    }

    async getAllOrders({ page = 1, limit = 10, status, userId } = {}) {
        const where = {};
        if (status) where.status = status;
        if (userId) where.userId = userId;

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Number(limit));

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    orderItems: { include: { product: true } },
                    shippingAddress: true
                },
                orderBy: { createdAt: 'desc' },
                skip: (pageNum - 1) * limitNum,
                take: limitNum
            }),
            prisma.order.count({ where })
        ]);

        const ordersWithTotals = orders.map(order => attachOrderTotal(order));

        return {
            count: ordersWithTotals.length,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            orders: ordersWithTotals.map(o => ({ 
                ...o, 
                _id: o.id,
                orderItems: (o.orderItems || []).map(i => ({ 
                    ...i, 
                    _id: i.id, 
                    price: Number(i.unitPriceAtPurchase), 
                    name: i.product?.name || 'Producto Desconocido', 
                    image: i.product?.imageUrl || DEFAULT_IMAGE 
                }))
            }))
        };
    }

    async updateOrderStatus(orderId, status) {
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new ErrorResponse('Orden no encontrada', 404);
        
        const normalizedStatus = typeof status === 'string' ? status.trim().toUpperCase() : '';
        if (!allowedOrderStatuses.has(normalizedStatus)) {
            throw new ErrorResponse(`Estado de orden inválido: ${status}`, 400);
        }

        const updated = await prisma.order.update({ where: { id: orderId }, data: { status: normalizedStatus } });
        return { ...updated, _id: updated.id };
    }

    async updateOrderToPaid(orderId) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { id: true, name: true, email: true } },
                orderItems: { include: { product: true } }
            }
        });

        if (!order) throw new ErrorResponse('Orden no encontrada', 404);

        const now = new Date();

        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: {
                isPaid: true,
                paidAt: order.paidAt || now
            },
            include: {
                user: { select: { id: true, name: true, email: true } },
                orderItems: { include: { product: true } }
            }
        });

        // Notify event bus of the payment event, but do not send keys yet as they are not assigned.
        await orderEventBus.notify('order:paid', {
            order: attachOrderTotal(updatedOrder),
            digitalKeys: [],
            meta: { shouldSendKeysEmail: false }
        });

        return {
            ...attachOrderTotal(updatedOrder),
            _id: updatedOrder.id
        };
    }

    async assignKeysToOrder(orderId) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { id: true, name: true, email: true } },
                orderItems: { include: { product: true } }
            }
        });

        if (!order) throw new ErrorResponse('Orden no encontrada', 404);
        if (!order.isPaid) throw new ErrorResponse('La orden debe estar pagada para asignar keys', 400);

        const now = new Date();

        const assignmentResult = await prisma.$transaction(async (tx) => {
            let assignedKeysCount = 0;

            for (const item of order.orderItems || []) {
                if (item.product?.type !== 'DIGITAL') continue;

                const alreadyAssigned = await tx.digitalKey.count({
                    where: { orderId, productId: item.productId }
                });

                const missingKeys = Math.max(0, Number(item.quantity) - alreadyAssigned);
                if (missingKeys === 0) continue;

                const availableKeys = await tx.digitalKey.findMany({
                    where: {
                        productId: item.productId,
                        status: 'AVAILABLE',
                        orderId: null,
                        isActive: true,
                    },
                    orderBy: { createdAt: 'asc' },
                    take: missingKeys,
                    select: { id: true }
                });

                if (availableKeys.length < missingKeys) {
                    throw new ErrorResponse(`No hay keys suficientes para ${item.product?.name || 'producto digital'}`, 409);
                }

                const keyIds = availableKeys.map(k => k.id);
                const updatedKeys = await tx.digitalKey.updateMany({
                    where: {
                        id: { in: keyIds },
                        status: 'AVAILABLE',
                        orderId: null,
                    },
                    data: {
                        status: 'SOLD',
                        orderId,
                        soldAt: now
                    }
                });

                if (updatedKeys.count !== keyIds.length) {
                    throw new ErrorResponse('No se pudieron reservar todas las keys de forma segura', 409);
                }

                assignedKeysCount += updatedKeys.count;

                const currentAvailable = await tx.digitalKey.count({
                    where: { productId: item.productId, status: 'AVAILABLE', isActive: true }
                });

                const nextStatus = currentAvailable > 0
                    ? (item.product?.status === 'OUT_OF_STOCK' ? 'ACTIVE' : item.product?.status)
                    : 'OUT_OF_STOCK';

                if (nextStatus && nextStatus !== item.product?.status) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { status: nextStatus }
                    });
                }
            }

            const updatedOrder = await tx.order.findUnique({
                where: { id: orderId },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    orderItems: { include: { product: true } },
                    digitalKeys: { select: { id: true, key: true, productId: true } }
                }
            });

            return { updatedOrder: attachOrderTotal(updatedOrder), assignedKeysCount };
        });

        // Notify event bus to trigger email now that keys are assigned
        if (assignmentResult?.assignedKeysCount > 0) {
            await orderEventBus.notify('order:paid', {
                order:       assignmentResult.updatedOrder,
                digitalKeys: assignmentResult.updatedOrder?.digitalKeys || [],
                meta:        { shouldSendKeysEmail: true }
            });
        }

        return {
            ...assignmentResult.updatedOrder,
            _id: assignmentResult.updatedOrder.id
        };
    }

    async createEscrowTransaction(orderId) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                orderItems: { include: { product: true } }
            }
        });

        if (!order) throw new ErrorResponse('Orden no encontrada', 404);
        if (!order.isPaid) throw new ErrorResponse('La orden debe estar pagada para crear la transacción de escrow', 400);

        const existingTransaction = await prisma.transaction.findUnique({
            where: { orderId }
        });
        if (existingTransaction) {
            throw new ErrorResponse('Ya existe una transacción de escrow para esta orden', 400);
        }

        // Check that keys have been assigned for all digital products in the order
        const assignedKeysCount = await prisma.digitalKey.count({
            where: { orderId }
        });

        let requiredDigitalKeysCount = 0;
        for (const item of order.orderItems || []) {
            if (item.product?.type === 'DIGITAL') {
                requiredDigitalKeysCount += Number(item.quantity);
            }
        }

        if (assignedKeysCount < requiredDigitalKeysCount) {
            throw new ErrorResponse('La orden debe tener todas las keys asignadas antes de crear la transacción de escrow', 400);
        }

        if (order.orderItems?.length > 0) {
            const firstItem = order.orderItems[0];
            const sellerId = firstItem.product?.sellerId;

            if (sellerId) {
                const orderTotal = calculateOrderTotal(order);
                const transaction = await prisma.transaction.create({
                    data: {
                        orderId: order.id,
                        sellerId,
                        amount: orderTotal,
                        status: 'PENDING_APPROVAL'
                    }
                });

                logger.info(`[OrderService] Transacción de escrow creada para orden ${order.id} - Vendedor: ${sellerId} - Monto: $${orderTotal} - Status: PENDING_APPROVAL`);
                return transaction;
            }
        }
        throw new ErrorResponse('No se pudo crear la transacción de escrow (vendedor no encontrado)', 400);
    }
}

module.exports = new OrderService();
// Force reload after schema push
