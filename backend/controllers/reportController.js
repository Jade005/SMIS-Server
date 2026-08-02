const ReportModel = require('../models/reportModel');

const getSalesReport = async (req, res, next) => {
  try {
    const { period, date } = req.query;
    const report = await ReportModel.getSalesReport({ period, date });
    res.json(report);
  } catch (error) {
    next(error);
  }
};

const getInventoryReport = async (req, res, next) => {
  try {
    const report = await ReportModel.getInventoryReport();
    res.json(report);
  } catch (error) {
    next(error);
  }
};

const getExpiryReport = async (req, res, next) => {
  try {
    const report = await ReportModel.getExpiryReport();
    res.json(report);
  } catch (error) {
    next(error);
  }
};

const getSupplierReport = async (req, res, next) => {
  try {
    const report = await ReportModel.getSupplierReport();
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
