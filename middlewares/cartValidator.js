/**
 * Capa de Seguridad: Validación de Entradas (Cart)
 * --------------------------------------------------------------------------
 * Centraliza la validación estricta de datos de carrito para evitar que
 * valores ambiguos o incompletos atraviesen la frontera HTTP.
 */

const { body, param, validationResult } = require('express-validator');

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

exports.addToCartValidation = [
    body('productId')
        .isString().withMessage('El productId es requerido')
        .trim()
        .notEmpty().withMessage('El productId es requerido'),
    body('quantity')
        .isInt({ min: 1 }).withMessage('La cantidad debe ser un entero mayor o igual a 1')
        .toInt(),
    validate
];

exports.updateCartItemValidation = [
    param('itemId')
        .isString().withMessage('El itemId es requerido')
        .trim()
        .notEmpty().withMessage('El itemId es requerido'),
    body('quantity')
        .isInt({ min: 1 }).withMessage('La cantidad debe ser un entero mayor o igual a 1')
        .toInt(),
    validate
];

exports.removeCartItemValidation = [
    param('itemId')
        .isString().withMessage('El itemId es requerido')
        .trim()
        .notEmpty().withMessage('El itemId es requerido'),
    validate
];
