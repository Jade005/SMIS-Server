const express = require('express');
const router = express.Router();
const {
  getSalesReport,
  getInventoryReport,
  getExpiryReport,
  getSupplierReport
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(protect);
router.use(authorize('admin'));

router.get('/sales', getSalesReport);
router.get('/inventory', getInventoryReport);
router.get('/expiry', getExpiryReport);
router.get('/suppliers', getSupplierReport);

module.exports = router;
