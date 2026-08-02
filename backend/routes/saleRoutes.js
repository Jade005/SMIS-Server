const express = require('express');
const router = express.Router();
const { getSales, getSaleById, createSale, getReceipt } = require('../controllers/saleController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', protect, authorize('admin', 'cashier'), getSales);
router.post('/', protect, authorize('cashier', 'admin'), createSale);
router.get('/:id', protect, authorize('admin', 'cashier'), getSaleById);
router.get('/:id/receipt', protect, authorize('admin', 'cashier'), getReceipt);

module.exports = router;
