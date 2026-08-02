const express = require('express');
const router = express.Router();
const {
  getOrders,
  getOrderById,
  getMyOrders,
  createOrder,
  updateOrderStatus,
  cancelOrder
} = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/my', protect, authorize('customer'), getMyOrders);
router.post('/', protect, authorize('customer'), createOrder);
router.delete('/:id', protect, authorize('customer'), cancelOrder);

router.get('/', protect, authorize('admin', 'cashier'), getOrders);
router.get('/:id', protect, getOrderById);
router.patch('/:id/status', protect, authorize('admin', 'cashier'), updateOrderStatus);

module.exports = router;
