const SaleModel = require('../models/saleModel');
const { formatReceipt } = require('../utils/receiptGenerator');

const getSales = async (req, res, next) => {
  try {
    const { cashier_id, date } = req.query;
    const sales = await SaleModel.getAll({ cashier_id, date });
    res.json(sales);
  } catch (error) {
    next(error);
  }
};

const getSaleById = async (req, res, next) => {
  try {
    const sale = await SaleModel.getById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale transaction not found' });
    res.json(sale);
  } catch (error) {
    next(error);
  }
};

const createSale = async (req, res, next) => {
  try {
    const cashier_id = req.user.id;
    const { customer_id, items, discount, payment_method, amount_tendered, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Sale items are required' });
    }

    const sale = await SaleModel.createSale({
      cashier_id,
      customer_id: customer_id || null,
      items,
      discount: discount || 0,
      payment_method: payment_method || 'cash',
      amount_tendered: amount_tendered || 0,
      notes
    });

    res.status(201).json({
      message: 'Sale transaction processed successfully',
      sale
    });
  } catch (error) {
    next(error);
  }
};

const getReceipt = async (req, res, next) => {
  try {
    const sale = await SaleModel.getById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale transaction not found' });

    const formattedReceipt = formatReceipt(
      sale,
      sale.items,
      { first_name: sale.cashier_name.split(' ')[0], last_name: sale.cashier_name.split(' ')[1] || '' }
    );

    res.json(formattedReceipt);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSales,
  getSaleById,
  createSale,
  getReceipt
};
