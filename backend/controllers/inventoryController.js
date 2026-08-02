const InventoryModel = require('../models/inventoryModel');

const getInventory = async (req, res, next) => {
  try {
    const { status, product_id, supplier_id } = req.query;
    const inventory = await InventoryModel.getAll({ status, product_id, supplier_id });
    res.json(inventory);
  } catch (error) {
    next(error);
  }
};

const getBatchById = async (req, res, next) => {
  try {
    const batch = await InventoryModel.getById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Inventory batch not found' });
    res.json(batch);
  } catch (error) {
    next(error);
  }
};

const addBatch = async (req, res, next) => {
  try {
    const { product_id, supplier_id, weight_kg, price_per_kg, date_processed, expiration_date, notes } = req.body;

    if (!product_id || !supplier_id || !weight_kg || !price_per_kg || !date_processed || !expiration_date) {
      return res.status(400).json({ message: 'Product, supplier, weight, price, date processed, and expiration date are required' });
    }

    const id = await InventoryModel.addBatch({
      product_id,
      supplier_id,
      weight_kg,
      price_per_kg,
      date_processed,
      expiration_date,
      notes
    });

    const batch = await InventoryModel.getById(id);
    res.status(201).json({ message: 'Inventory batch created successfully', batch });
  } catch (error) {
    next(error);
  }
};

const updateBatch = async (req, res, next) => {
  try {
    const { weight_kg, available_stock_kg, price_per_kg, date_processed, expiration_date, status, notes } = req.body;
    const batch = await InventoryModel.updateBatch(req.params.id, {
      weight_kg,
      available_stock_kg,
      price_per_kg,
      date_processed,
      expiration_date,
      status,
      notes
    });
    res.json({ message: 'Inventory batch updated successfully', batch });
  } catch (error) {
    next(error);
  }
};

const updateBatchStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const batch = await InventoryModel.updateStatus(req.params.id, status);
    res.json({ message: `Batch status changed to '${status}'`, batch });
  } catch (error) {
    next(error);
  }
};

const getLowStockAlerts = async (req, res, next) => {
  try {
    const threshold = req.query.threshold ? Number(req.query.threshold) : 10;
    const alerts = await InventoryModel.getLowStockAlerts(threshold);
    res.json(alerts);
  } catch (error) {
    next(error);
  }
};

const getExpiringAlerts = async (req, res, next) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 3;
    const alerts = await InventoryModel.getExpiringAlerts(days);
    res.json(alerts);
  } catch (error) {
    next(error);
  }
};

const getExpiredAlerts = async (req, res, next) => {
  try {
    const alerts = await InventoryModel.getExpiredAlerts();
    res.json(alerts);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInventory,
  getBatchById,
  addBatch,
  updateBatch,
  updateBatchStatus,
  getLowStockAlerts,
  getExpiringAlerts,
  getExpiredAlerts
};
