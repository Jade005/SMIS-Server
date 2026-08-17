const OrderModel = require('../models/orderModel');
const CustomerModel = require('../models/customerModel');
const { query } = require('../config/db');

const getOrders = async (req, res, next) => {
  try {
    const { status, customer_id } = req.query;
    const orders = await OrderModel.getAll({ status, customer_id });
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await OrderModel.getById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const customer = await CustomerModel.getByUserId(req.user.id);
    if (!customer) return res.status(404).json({ message: 'Customer profile not found' });

    const orders = await OrderModel.getAll({ customer_id: customer.id });
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

const createOrder = async (req, res, next) => {
  try {
    let customer = await CustomerModel.getByUserId(req.user.id);

    if (!customer || !customer.customer_id) {
      const existingCustomer = await CustomerModel.getByUserId(req.user.id);
      if (!existingCustomer || !existingCustomer.customer_id) {
        await query(
          'INSERT INTO customers (user_id, phone, address) VALUES (?, ?, ?)',
          [req.user.id, null, null]
        );
      }
      customer = await CustomerModel.getByUserId(req.user.id);
    }

    const customerId = customer?.customer_id || customer?.id;
    if (!customerId) {
      return res.status(400).json({ message: 'Only registered customer accounts can place online pre-orders' });
    }

    const { items, notes } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }

    const order = await OrderModel.createOrder({
      customer_id: customerId,
      items,
      notes
    });

    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'ready', 'cancelled', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${validStatuses.join(', ')}` });
    }

    const order = await OrderModel.updateStatus(req.params.id, status);
    res.json({ message: `Order status updated to '${status}'`, order });
  } catch (error) {
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const order = await OrderModel.getById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending orders can be cancelled' });
    }

    const updated = await OrderModel.updateStatus(req.params.id, 'cancelled');
    res.json({ message: 'Order cancelled successfully', order: updated });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrders,
  getOrderById,
  getMyOrders,
  createOrder,
  updateOrderStatus,
  cancelOrder
};
