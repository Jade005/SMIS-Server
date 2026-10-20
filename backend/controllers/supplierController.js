const SupplierModel = require('../models/supplierModel');

const getSuppliers = async (req, res, next) => {
  try {
    const { is_active, search } = req.query;
    const suppliers = await SupplierModel.getAll({ is_active, search });
    res.json(suppliers);
  } catch (error) {
    next(error);
  }
};

const getSupplierById = async (req, res, next) => {
  try {
    const supplier = await SupplierModel.getById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (error) {
    next(error);
  }
};

const createSupplier = async (req, res, next) => {
  try {
    const { name, contact_person, phone, email, address } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Supplier name is required' });

    const existing = await SupplierModel.getByName(name);
    if (existing) {
      return res.status(400).json({ message: `A supplier named "${name.trim()}" already exists` });
    }

    const id = await SupplierModel.create({ name: name.trim(), contact_person, phone, email, address });
    const supplier = await SupplierModel.getById(id);
    res.status(201).json({ message: 'Supplier created successfully', supplier });
  } catch (error) {
    next(error);
  }
};

const updateSupplier = async (req, res, next) => {
  try {
    const { name, contact_person, phone, email, address } = req.body;
    const supplier = await SupplierModel.update(req.params.id, { name, contact_person, phone, email, address });
    res.json({ message: 'Supplier updated successfully', supplier });
  } catch (error) {
    next(error);
  }
};

const toggleSupplierStatus = async (req, res, next) => {
  try {
    const { is_active } = req.body;
    const supplier = await SupplierModel.toggleStatus(req.params.id, is_active);
    res.json({ message: `Supplier set to ${is_active ? 'active' : 'inactive'}`, supplier });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  toggleSupplierStatus
};
