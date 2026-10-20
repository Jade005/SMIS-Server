const path = require('path');
const fs = require('fs');
const ProductModel = require('../models/productModel');

// Helper to safely delete an uploaded product photo from disk
const deleteUploadedFile = (relPath) => {
  if (!relPath || typeof relPath !== 'string') return;
  // If it's a web URL (http:// or https://), don't touch
  if (relPath.startsWith('http://') || relPath.startsWith('https://')) return;

  const cleanPath = relPath.replace(/^\/+/, '');
  const fullPath = path.join(__dirname, '..', cleanPath);
  const productsDir = path.resolve(__dirname, '../uploads/products');
  const resolvedTarget = path.resolve(fullPath);

  // Security check: only delete files strictly inside uploads/products
  if (resolvedTarget.startsWith(productsDir) && fs.existsSync(resolvedTarget)) {
    try {
      fs.unlinkSync(resolvedTarget);
    } catch (e) {
      console.warn('Failed to delete product photo:', e.message);
    }
  }
};

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
      // If a file was uploaded in this invalid request, clean it up
      if (req.file) {
        deleteUploadedFile(`/uploads/products/${req.file.filename}`);
      }
      return res.status(400).json({ message: 'Category, name, meat type, cut, and price per kg are required' });
    }

    let finalImageUrl = null;
    if (req.file) {
      finalImageUrl = `/uploads/products/${req.file.filename}`;
    } else if (image_url && image_url.trim()) {
      finalImageUrl = image_url.trim();
    }

    const id = await ProductModel.create({
      category_id,
      name,
      meat_type,
      meat_cut,
      price_per_kg,
      description,
      image_url: finalImageUrl
    });
    const product = await ProductModel.getById(id);
    res.status(201).json({ message: 'Product created successfully', product });
  } catch (error) {
    if (req.file) {
      deleteUploadedFile(`/uploads/products/${req.file.filename}`);
    }
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const existing = await ProductModel.getById(req.params.id);
    if (!existing) {
      if (req.file) {
        deleteUploadedFile(`/uploads/products/${req.file.filename}`);
      }
      return res.status(404).json({ message: 'Product not found' });
    }

    const { category_id, name, meat_type, meat_cut, price_per_kg, description, image_url, remove_photo } = req.body;

    let finalImageUrl = existing.image_url;

    if (req.file) {
      // New photo uploaded: delete old photo if exists
      deleteUploadedFile(existing.image_url);
      finalImageUrl = `/uploads/products/${req.file.filename}`;
    } else if (remove_photo === 'true' || remove_photo === true) {
      // Explicit removal requested
      deleteUploadedFile(existing.image_url);
      finalImageUrl = null;
    } else if (image_url !== undefined) {
      // If explicit string passed
      finalImageUrl = image_url ? image_url.trim() : null;
    }

    const product = await ProductModel.update(req.params.id, {
      category_id: category_id !== undefined ? category_id : existing.category_id,
      name: name !== undefined ? name : existing.name,
      meat_type: meat_type !== undefined ? meat_type : existing.meat_type,
      meat_cut: meat_cut !== undefined ? meat_cut : existing.meat_cut,
      price_per_kg: price_per_kg !== undefined ? price_per_kg : existing.price_per_kg,
      description: description !== undefined ? description : existing.description,
      image_url: finalImageUrl
    });

    res.json({ message: 'Product updated successfully', product });
  } catch (error) {
    if (req.file) {
      deleteUploadedFile(`/uploads/products/${req.file.filename}`);
    }
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const existing = await ProductModel.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Product not found' });
    }

    deleteUploadedFile(existing.image_url);
    await ProductModel.delete(req.params.id);
    res.json({ message: 'Product deleted successfully', id: req.params.id });
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
  deleteProduct,
  toggleProductStatus
};
