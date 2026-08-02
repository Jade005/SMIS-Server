const express = require('express');
const router = express.Router();
const {
  getRevenueTrends,
  getBestSellers,
  getSalesByCategory
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(protect);
router.use(authorize('admin'));

router.get('/revenue', getRevenueTrends);
router.get('/best-sellers', getBestSellers);
router.get('/sales-by-category', getSalesByCategory);

module.exports = router;
