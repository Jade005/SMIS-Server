const express = require('express');
const router = express.Router();
const {
  getInventory,
  getBatchById,
  addBatch,
  updateBatch,
  updateBatchStatus,
  getLowStockAlerts,
  getExpiringAlerts,
  getExpiredAlerts
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/alerts/low-stock', protect, authorize('admin', 'cashier'), getLowStockAlerts);
router.get('/alerts/expiring', protect, authorize('admin', 'cashier'), getExpiringAlerts);
router.get('/alerts/expired', protect, authorize('admin'), getExpiredAlerts);

router.get('/', protect, authorize('admin', 'cashier'), getInventory);
router.get('/:id', protect, authorize('admin', 'cashier'), getBatchById);
router.post('/', protect, authorize('admin'), addBatch);
router.put('/:id', protect, authorize('admin'), updateBatch);
router.patch('/:id/status', protect, authorize('admin'), updateBatchStatus);

module.exports = router;
