/**
 * Capa de Seguridad: Validación de Entradas (Contact)
 * --------------------------------------------------------------------------
 * Normaliza el formulario de contacto antes de que alcance al controlador.
 */

const { body, validationResult } = require('express-validator');

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

exports.contactValidation = [
    body('firstName')
        .isString().withMessage('El nombre es requerido')
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres'),
    body('lastName')
        .isString().withMessage('El apellido es requerido')
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('El apellido debe tener entre 2 y 50 caracteres'),
    body('email')
        .isEmail().withMessage('Debe proporcionar un email válido')
        .normalizeEmail({
            gmail_remove_dots: false,
            outlookdotcom_remove_subaddress: false,
            gmail_remove_subaddress: false
        }),
    body('message')
        .isString().withMessage('El mensaje es requerido')
        .trim()
        .isLength({ min: 10, max: 1000 }).withMessage('El mensaje debe tener entre 10 y 1000 caracteres'),
    validate
];
