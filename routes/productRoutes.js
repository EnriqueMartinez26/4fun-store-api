const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductsAdmin,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getSellerProducts,
  getProductManagement
} = require('../controllers/productController');
const { protect, authorize } = require('../middlewares/auth');
const verifyProductOwnership = require('../middlewares/verifyProductOwnership');
const {
  productIdValidation,
  productListQueryValidation,
  createProductValidation,
  updateProductValidation
} = require('../middlewares/productValidator');
const { upload } = require('../config/cloudinary');

/**
 * Capa de Enrutamiento: Catálogo Maestro de Productos (Store)
 * --------------------------------------------------------------------------
 * Eje central del escaparate comercial. Organiza la visibilidad de la 
 * mercadería y sus herramientas de administración jerárquica. (MVC / Router)
 */

// ─── ESCAPARATE PÚBLICO (READ-ONLY) ───

/** @route GET /api/products - Consulta con filtros, paginación y ordenamiento. */
router.get('/', productListQueryValidation, getProducts);

/** @route GET /api/products/admin - Listado administrativo global (Admin Only). */
router.get('/admin', protect, authorize('ADMIN'), productListQueryValidation, getProductsAdmin);

/** @route GET /api/products/seller/me - Listado de productos de autoría propia (Seller Only). */
router.get('/seller/me', protect, authorize('SELLER', 'ADMIN'), productListQueryValidation, getSellerProducts);

/** @route GET /api/products/:id/management - Vista de detalle para gestión (Solo Dueño o Admin). */
router.get('/:id/management', protect, authorize('ADMIN', 'SELLER'), productIdValidation, verifyProductOwnership, getProductManagement);

/** @route GET /api/products/:id - Vista de detalle de artículo (Pública). */
router.get('/:id', productIdValidation, getProduct);


// ─── GESTIÓN DE INVENTARIO (ADMIN & SELLER) ───

/** @route POST /api/products - Alta de nuevo producto (Asociado al usuario activo). */
router.post('/', protect, authorize('ADMIN', 'SELLER'), upload.single('image'), createProductValidation, createProduct);

/** @route PUT /api/products/:id - Edición integral de ficha de producto (con validación de propiedad). */
router.put('/:id', protect, authorize('ADMIN', 'SELLER'), productIdValidation, upload.single('image'), updateProductValidation, verifyProductOwnership, updateProduct);

/** @route DELETE /api/products/:id - Eliminación lógica (Soft Delete) individual (con validación de propiedad). */
router.delete('/:id', protect, authorize('ADMIN', 'SELLER'), productIdValidation, verifyProductOwnership, deleteProduct);

module.exports = router;
