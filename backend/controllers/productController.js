const ProductModel = require('../models/productModel');

const getProducts = async (req, res, next) => {
  try {
    const { category_id, meat_type, is_active, search } = req.query;
    const products = await ProductModel.getAll({ category_id, meat_type, is_active, search });
    res.json(products);
  } catch (error) {
    next(error);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await ProductModel.getById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const { category_id, name, meat_type, meat_cut, price_per_kg, description, image_url } = req.body;

    if (!category_id || !name || !meat_type || !meat_cut || price_per_kg === undefined) {
      return res.status(400).json({ message: 'Category, name, meat type, cut, and price per kg are required' });
    }

    const id = await ProductModel.create({ category_id, name, meat_type, meat_cut, price_per_kg, description, image_url });
    const product = await ProductModel.getById(id);
    res.status(201).json({ message: 'Product created successfully', product });
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { category_id, name, meat_type, meat_cut, price_per_kg, description, image_url } = req.body;
    const product = await ProductModel.update(req.params.id, { category_id, name, meat_type, meat_cut, price_per_kg, description, image_url });
    res.json({ message: 'Product updated successfully', product });
  } catch (error) {
    next(error);
  }
};

const toggleProductStatus = async (req, res, next) => {
  try {
    const { is_active } = req.body;
    const product = await ProductModel.toggleStatus(req.params.id, is_active);
    res.json({ message: `Product status set to ${is_active ? 'active' : 'inactive'}`, product });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductStatus
};
