/**
 * Capa de Seguridad: Validación de Entradas (Products)
 * --------------------------------------------------------------------------
 * Centraliza el contrato HTTP de productos para impedir payloads ambiguos,
 * campos deprecados y coerciones silenciosas.
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

const allowedSpecPresets = ['LOW', 'MID', 'HIGH'];
const allowedSorts = ['price', '-price', 'rating', '-rating', 'name', '-name', 'order'];

exports.productIdValidation = [
    param('id')
        .isUUID()
        .withMessage('El id del producto debe ser un UUID válido'),
    validate
];

exports.productListQueryValidation = [
    query('search')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('El término de búsqueda debe ser un texto válido')
        .isLength({ min: 1, max: 120 })
        .withMessage('El término de búsqueda debe tener entre 1 y 120 caracteres'),
    query('platform')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('La plataforma debe ser un texto válido')
        .isLength({ min: 1, max: 500 })
        .withMessage('La plataforma debe tener un formato válido'),
    query('genre')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('El género debe ser un texto válido')
        .isLength({ min: 1, max: 500 })
        .withMessage('El género debe tener un formato válido'),
    query('minPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('El precio mínimo debe ser un número válido')
        .toFloat(),
    query('maxPrice')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('El precio máximo debe ser un número válido')
        .toFloat(),
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('La página debe ser un entero mayor o igual a 1')
        .toInt(),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('El límite debe ser un entero entre 1 y 100')
        .toInt(),
    query('sort')
        .optional()
        .isIn(allowedSorts)
        .withMessage('El ordenamiento solicitado no es válido'),
    query('discounted')
        .optional()
        .isBoolean()
        .withMessage('discounted debe ser un valor booleano')
        .toBoolean(),
    validate
];

exports.createProductValidation = [
    body('name')
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('El nombre es requerido')
        .isLength({ min: 2, max: 120 }).withMessage('El nombre debe tener entre 2 y 120 caracteres'),
    body('description')
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('La descripción es requerida')
        .isLength({ min: 10, max: 5000 }).withMessage('La descripción debe tener entre 10 y 5000 caracteres'),
    body('price')
        .isFloat({ min: 0 }).withMessage('El precio debe ser un número válido')
        .toFloat(),
    body('platformId')
        .isUUID().withMessage('Seleccione una plataforma válida'),
    body('genreId')
        .isUUID().withMessage('Seleccione un género válido'),
    body('developer')
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('El desarrollador es requerido')
        .isLength({ min: 2, max: 120 }).withMessage('El desarrollador debe tener entre 2 y 120 caracteres'),
    body('specPreset')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
        .isIn(allowedSpecPresets)
        .withMessage(`specPreset debe ser uno de: ${allowedSpecPresets.join(', ')}`),
    body('releaseDate')
        .optional()
        .isISO8601({ strict: true })
        .withMessage('La fecha de lanzamiento debe tener formato ISO válido'),
    body('imageId')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('La imagen debe ser un texto válido')
        .isLength({ min: 1, max: 2048 }).withMessage('La imagen debe tener un formato válido'),
    body('trailerUrl')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('El trailer debe ser un texto válido')
        .isLength({ min: 1, max: 2048 }).withMessage('El trailer debe tener un formato válido'),
    body('active')
        .optional()
        .toBoolean(),
    body('discountPercentage')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('El porcentaje de descuento debe estar entre 0 y 100')
        .toFloat(),
    body('discountEndDate')
        .optional()
        .isISO8601({ strict: true })
        .withMessage('La fecha de fin del descuento debe tener formato ISO válido'),
    body('requirements')
        .optional({ nullable: true })
        .custom((value) => value === null || (typeof value === 'object' && !Array.isArray(value)))
        .withMessage('El bloque de requisitos debe ser un objeto válido'),
    body('type')
        .not()
        .exists()
        .withMessage('type ya no forma parte del contrato HTTP de productos'),
    body('stock')
        .not()
        .exists()
        .withMessage('stock ya no forma parte del contrato HTTP de productos'),
    body('isDiscounted')
        .not()
        .exists()
        .withMessage('isDiscounted ya no forma parte del contrato HTTP de productos'),
    validate
];

exports.updateProductValidation = [
    body('name')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('El nombre debe ser un texto válido')
        .isLength({ min: 2, max: 120 }).withMessage('El nombre debe tener entre 2 y 120 caracteres'),
    body('description')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('La descripción debe ser un texto válido')
        .isLength({ min: 10, max: 5000 }).withMessage('La descripción debe tener entre 10 y 5000 caracteres'),
    body('price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('El precio debe ser un número válido')
        .toFloat(),
    body('platformId')
        .optional()
        .isUUID()
        .withMessage('La plataforma debe ser un UUID válido'),
    body('genreId')
        .optional()
        .isUUID()
        .withMessage('El género debe ser un UUID válido'),
    body('developer')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('El desarrollador debe ser un texto válido')
        .isLength({ min: 2, max: 120 }).withMessage('El desarrollador debe tener entre 2 y 120 caracteres'),
    body('specPreset')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
        .isIn(allowedSpecPresets)
        .withMessage(`specPreset debe ser uno de: ${allowedSpecPresets.join(', ')}`),
    body('releaseDate')
        .optional()
        .isISO8601({ strict: true })
        .withMessage('La fecha de lanzamiento debe tener formato ISO válido'),
    body('imageId')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('La imagen debe ser un texto válido')
        .isLength({ min: 1, max: 2048 }).withMessage('La imagen debe tener un formato válido'),
    body('trailerUrl')
        .optional()
        .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
        .isString().withMessage('El trailer debe ser un texto válido')
        .isLength({ min: 1, max: 2048 }).withMessage('El trailer debe tener un formato válido'),
    body('active')
        .optional()
        .toBoolean(),
    body('discountPercentage')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('El porcentaje de descuento debe estar entre 0 y 100')
        .toFloat(),
    body('discountEndDate')
        .optional()
        .isISO8601({ strict: true })
        .withMessage('La fecha de fin del descuento debe tener formato ISO válido'),
    body('requirements')
        .optional({ nullable: true })
        .custom((value) => value === null || (typeof value === 'object' && !Array.isArray(value)))
        .withMessage('El bloque de requisitos debe ser un objeto válido'),
    body('type')
        .not()
        .exists()
        .withMessage('type ya no forma parte del contrato HTTP de productos'),
    body('stock')
        .not()
        .exists()
        .withMessage('stock ya no forma parte del contrato HTTP de productos'),
    body('isDiscounted')
        .not()
        .exists()
        .withMessage('isDiscounted ya no forma parte del contrato HTTP de productos'),
    validate
];
