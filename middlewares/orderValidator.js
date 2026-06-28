/**
 * Capa de Seguridad: Validación de Entradas (Orders)
 * --------------------------------------------------------------------------
 * Restringe el contrato HTTP del ciclo de órdenes para eliminar coerciones
 * laxas y atributos redundantes.
 */

const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Error de validación',
            errors: errors.array().map((error) => error.msg)
        });
    }

    next();
};

const allowedOrderStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const allowedPaymentMethods = ['MERCADOPAGO', 'TRANSFER', 'CASH'];

exports.orderIdValidation = [
    param('id')
        .isUUID()
        .withMessage('El id de la orden debe ser un UUID válido'),
    validate
];

exports.createOrderValidation = [
    body('userId')
        .not()
        .exists()
        .withMessage('userId no debe enviarse; la orden se asocia a la sesión autenticada'),
    body('paymentMethod')
        .customSanitizer((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
        .isIn(allowedPaymentMethods)
        .withMessage(`paymentMethod debe ser uno de: ${allowedPaymentMethods.join(', ')}`),
    body('shippingAddress')
        .exists()
        .withMessage('La dirección de envío es obligatoria')
        .isObject({ strict: true })
        .withMessage('La dirección de envío debe ser un objeto válido'),
    body('shippingAddress.fullName')
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('shippingAddress.fullName es requerido')
        .isLength({ min: 2, max: 120 }).withMessage('El nombre del destinatario debe tener entre 2 y 120 caracteres'),
    body('shippingAddress.street')
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('shippingAddress.street es requerido')
        .isLength({ min: 4, max: 200 }).withMessage('La calle debe tener entre 4 y 200 caracteres'),
    body('shippingAddress.city')
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('shippingAddress.city es requerido')
        .isLength({ min: 2, max: 120 }).withMessage('La ciudad debe tener entre 2 y 120 caracteres'),
    body('shippingAddress.state')
        .optional({ nullable: true })
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('shippingAddress.state debe ser un texto válido')
        .isLength({ min: 2, max: 120 }).withMessage('El estado/provincia debe tener entre 2 y 120 caracteres'),
    body('shippingAddress.zip')
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('shippingAddress.zip es requerido')
        .isLength({ min: 3, max: 20 }).withMessage('El código postal debe tener entre 3 y 20 caracteres'),
    body('shippingAddress.country')
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('shippingAddress.country es requerido')
        .isLength({ min: 2, max: 80 }).withMessage('El país debe tener entre 2 y 80 caracteres'),
    body('orderItems')
        .isArray({ min: 1 })
        .withMessage('Debes enviar al menos un ítem de orden'),
    body('orderItems.*.product')
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isUUID()
        .withMessage('Cada item debe incluir un product válido'),
    body('orderItems.*.quantity')
        .isInt({ min: 1 })
        .withMessage('Cada item debe incluir una quantity entera mayor o igual a 1')
        .toInt(),
    validate
];

exports.userOrderQueryValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('La página debe ser un entero mayor o igual a 1')
        .toInt(),
    query('limit')
        .optional()
        .isInt({ min: 1 })
        .withMessage('El límite debe ser un entero mayor o igual a 1')
        .toInt(),
    validate
];

exports.orderListQueryValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('La página debe ser un entero mayor o igual a 1')
        .toInt(),
    query('limit')
        .optional()
        .isInt({ min: 1 })
        .withMessage('El límite debe ser un entero mayor o igual a 1')
        .toInt(),
    query('status')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
        .isIn(allowedOrderStatuses)
        .withMessage(`status debe ser uno de: ${allowedOrderStatuses.join(', ')}`),
    query('userId')
        .optional()
        .isUUID()
        .withMessage('userId debe ser un UUID válido'),
    validate
];

exports.updateOrderStatusValidation = [
    param('id')
        .isUUID()
        .withMessage('El id de la orden debe ser un UUID válido'),
    body('status')
        .customSanitizer((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
        .isIn(allowedOrderStatuses)
        .withMessage(`status debe ser uno de: ${allowedOrderStatuses.join(', ')}`),
    validate
];
