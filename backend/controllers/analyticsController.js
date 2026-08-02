const AnalyticsModel = require('../models/analyticsModel');

const getRevenueTrends = async (req, res, next) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;
    const trends = await AnalyticsModel.getRevenueTrends(days);
    res.json(trends);
  } catch (error) {
    next(error);
  }
};

const getBestSellers = async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 5;
    const bestSellers = await AnalyticsModel.getBestSellers(limit);
    res.json(bestSellers);
  } catch (error) {
    next(error);
  }
};

const getSalesByCategory = async (req, res, next) => {
  try {
    const categories = await AnalyticsModel.getSalesByCategory();
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRevenueTrends,
  getBestSellers,
  getSalesByCategory
};
