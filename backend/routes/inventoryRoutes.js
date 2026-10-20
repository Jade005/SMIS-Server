const express = require('express');
const router = express.Router();
const {
  getInventory,
  getInventoryCounts,
  getBatchById,
  addBatch,
  updateBatch,
  updateBatchStatus,
  disposeBatch,
  disposeAllExpired,
  getDisposals,
  getLowStockAlerts,
  getExpiringAlerts,
  getExpiredAlerts
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Alerts
router.get('/alerts/low-stock', protect, authorize('admin', 'cashier'), getLowStockAlerts);
router.get('/alerts/expiring', protect, authorize('admin', 'cashier'), getExpiringAlerts);
router.get('/alerts/expired', protect, authorize('admin'), getExpiredAlerts);

// Tab Counts & Disposals history
router.get('/counts', protect, authorize('admin', 'cashier'), getInventoryCounts);
router.get('/disposals', protect, authorize('admin'), getDisposals);

// Disposal Actions (Admin only)
router.post('/dispose-all-expired', protect, authorize('admin'), disposeAllExpired);
router.post('/:id/dispose', protect, authorize('admin'), disposeBatch);

// Standard CRUD
router.get('/', protect, authorize('admin', 'cashier'), getInventory);
router.get('/:id', protect, authorize('admin', 'cashier'), getBatchById);
router.post('/', protect, authorize('admin'), addBatch);
router.put('/:id', protect, authorize('admin'), updateBatch);
router.patch('/:id/status', protect, authorize('admin'), updateBatchStatus);

module.exports = router;

