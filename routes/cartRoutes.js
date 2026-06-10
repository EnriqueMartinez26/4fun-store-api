const express = require('express');
const { protect } = require('../middlewares/auth');
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

/** @route POST /api/cart e /api/cart/items - Integra una nueva intención de compra. */
router.post('/', addToCart);
router.post('/items', addToCart);

/** @route PUT/PATCH /api/cart, /api/cart/items, /api/cart/:itemId, /api/cart/items/:itemId - Ajusta volúmenes. */
router.put('/', updateCartItem);
router.put('/items', updateCartItem);
router.put('/:itemId', updateCartItem);
router.put('/items/:itemId', updateCartItem);

router.patch('/', updateCartItem);
router.patch('/items', updateCartItem);
router.patch('/:itemId', updateCartItem);
router.patch('/items/:itemId', updateCartItem);

/** @route DELETE /api/cart/:itemId y /api/cart/items/:itemId - Expulsa una línea específica. */
router.delete('/:itemId', removeFromCart);
router.delete('/items/:itemId', removeFromCart);

/** @route DELETE /api/cart - Vaciado total (Reset) de la instancia temporal. */
router.delete('/', clearCart);

module.exports = router;
