const InventoryModel = require('../models/inventoryModel');

const getInventory = async (req, res, next) => {
  try {
    const { status, tab, product_id, supplier_id, search, include_disposed } = req.query;
    const inventory = await InventoryModel.getAll({ status, tab, product_id, supplier_id, search, include_disposed });
    res.json(inventory);
  } catch (error) {
    next(error);
  }
};

const getInventoryCounts = async (req, res, next) => {
  try {
    const raw = await InventoryModel.getCounts();
    res.json({
      all: raw.all_count || 0,
      active: raw.active_count || 0,
      low: raw.low_count || 0,
      expired: raw.expired_count || 0,
      disposed: raw.disposed_count || 0,
      expired_weight_kg: Number(raw.expired_total_kg || 0),
      ...raw
    });
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

const disposeBatch = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const userName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'Admin';
    const reason = req.body.reason || 'Expired stock disposal';

    const result = await InventoryModel.disposeBatch(req.params.id, { userId, userName, reason });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const disposeAllExpired = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const userName = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'Admin';
    const reason = req.body.reason || 'Bulk expired stock disposal';

    const result = await InventoryModel.disposeAllExpired({ userId, userName, reason });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getDisposals = async (req, res, next) => {
  try {
    const disposals = await InventoryModel.getDisposals();
    res.json(disposals);
  } catch (error) {
    next(error);
  }
};

const getLowStockAlerts = async (req, res, next) => {
  try {
    const alerts = await InventoryModel.getLowStockAlerts();
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
};
