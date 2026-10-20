const ReportModel = require('../models/reportModel');

const getSalesReport = async (req, res, next) => {
  try {
    const { granularity, from, to, period, date } = req.query;
    const report = await ReportModel.getSalesReport({ granularity, from, to, period, date });
    res.json(report);
  } catch (error) {
    next(error);
  }
};

const getInventoryReport = async (req, res, next) => {
  try {
    const { granularity, from, to } = req.query;
    const report = await ReportModel.getInventoryReport({ granularity, from, to });
    res.json(report);
  } catch (error) {
    next(error);
  }
};

const getExpiryReport = async (req, res, next) => {
  try {
    const { granularity, from, to } = req.query;
    const report = await ReportModel.getExpiryReport({ granularity, from, to });
    res.json(report);
  } catch (error) {
    next(error);
  }
};

const getSupplierReport = async (req, res, next) => {
  try {
    const { granularity, from, to } = req.query;
    const report = await ReportModel.getSupplierReport({ granularity, from, to });
    res.json(report);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSalesReport,
  getInventoryReport,
  getExpiryReport,
  getSupplierReport
};
