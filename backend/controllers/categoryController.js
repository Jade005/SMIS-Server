const CategoryModel = require('../models/categoryModel');

const getCategories = async (req, res, next) => {
  try {
    const categories = await CategoryModel.getAll();
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Category name is required' });

    const id = await CategoryModel.create({ name, description });
    const category = await CategoryModel.getById(id);
    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const category = await CategoryModel.update(req.params.id, { name, description });
    res.json({ message: 'Category updated successfully', category });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    await CategoryModel.delete(req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
};
