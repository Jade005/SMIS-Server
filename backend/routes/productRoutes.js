const express = require('express');
const router = express.Router();
const {
  getProducts,
  getShowcaseProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { handleProductPhotoUpload } = require('../middleware/upload');

// Public showcase / catalog preview endpoints (no auth required)
router.get('/showcase', getShowcaseProducts);
router.get('/public', getShowcaseProducts);

router.get('/', protect, getProducts);
router.get('/:id', protect, getProductById);
router.post('/', protect, authorize('admin'), handleProductPhotoUpload, createProduct);
router.put('/:id', protect, authorize('admin'), handleProductPhotoUpload, updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);
router.patch('/:id/status', protect, authorize('admin'), toggleProductStatus);

module.exports = router;

