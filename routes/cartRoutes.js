const express = require('express');
const { protect } = require('../middlewares/auth');
const {
  addToCartValidation,
  updateCartItemValidation,
  removeCartItemValidation
} = require('../middlewares/cartValidator');
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
} = require('../controllers/cartController');

const router = express.Router();

/**
 * Capa de Enrutamiento: Gestión de Carrito de Compras (Cart)
 * --------------------------------------------------------------------------
 * Centraliza las operaciones de persistencia temporal de artículos.
 * 
 * RN - Seguridad: Todas las interacciones con el carro están blindadas bajo 
 * el middleware 'protect', asegurando que la cesta esté vinculada unívocamente
 * al ID del usuario autenticado en la sesión. (MVC / Router)
 */

router.use(protect); // Global protector para este recurso

/** @route GET /api/cart - Recupera el estado actual de la cesta del usuario. */
router.get('/', getCart);

/** @route POST /api/cart - Integra una nueva intención de compra. */
router.post('/', addToCartValidation, addToCart);

/** @route PUT /api/cart/:itemId - Ajusta volúmenes. */
router.put('/:itemId', updateCartItemValidation, updateCartItem);

/** @route DELETE /api/cart/:itemId - Expulsa una línea específica. */
router.delete('/:itemId', removeCartItemValidation, removeFromCart);

/** @route DELETE /api/cart - Vaciado total (Reset) de la instancia temporal. */
router.delete('/', clearCart);

module.exports = router;
