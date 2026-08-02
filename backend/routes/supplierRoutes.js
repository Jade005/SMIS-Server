const express = require('express');
const router = express.Router();
const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  toggleSupplierStatus
} = require('../controllers/supplierController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', protect, authorize('admin', 'cashier'), getSuppliers);
router.get('/:id', protect, authorize('admin'), getSupplierById);
router.post('/', protect, authorize('admin'), createSupplier);
router.put('/:id', protect, authorize('admin'), updateSupplier);
router.patch('/:id/status', protect, authorize('admin'), toggleSupplierStatus);

module.exports = router;
