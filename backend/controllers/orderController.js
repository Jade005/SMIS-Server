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

    // Security check: if customer, ensure the order belongs to them
    if (req.user && req.user.role === 'customer') {
      const customer = await CustomerModel.getByUserId(req.user.id);
      if (!customer || !customer.customer_id || Number(order.customer_id) !== Number(customer.customer_id)) {
        return res.status(403).json({ message: 'You are not authorized to view this order' });
      }

      // Explicitly sanitize response for customer view: ensure no cashier/internal data is exposed
      const sanitizedItems = (order.items || []).map((it) => ({
        id: it.id,
        product_id: it.product_id,
        product_name: it.product_name,
        meat_cut: it.meat_cut,
        weight_kg: it.weight_kg,
        price_per_kg: it.price_per_kg,
        subtotal: it.subtotal
      }));

      return res.json({
        id: order.id,
        order_no: order.order_no,
        status: order.status,
        subtotal: order.subtotal,
        total_amount: order.total_amount,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        items: sanitizedItems
      });
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const customer = await CustomerModel.getByUserId(req.user.id);
    if (!customer || !customer.customer_id) {
      // No customer profile — return empty list, never fall back to all orders
      return res.json([]);
    }

    const orders = await OrderModel.getAll({ customer_id: customer.customer_id });
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

    // Verify ownership: the order must belong to the logged-in customer
    const customer = await CustomerModel.getByUserId(req.user.id);
    if (!customer || !customer.customer_id || Number(order.customer_id) !== Number(customer.customer_id)) {
      return res.status(403).json({ message: 'You are not authorized to cancel this order' });
    }

    if (order.status !== 'pending') {
      return res.status(409).json({ message: 'This order has already been confirmed and can no longer be cancelled' });
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
