const ReportModel = require('../models/reportModel');

const normalizeReportQuery = (query) => {
  const { granularity, from, to, start_date, end_date, month, year, period, date } = query;
  let finalGranularity = granularity || 'daily';
  let finalFrom = from || start_date;
  let finalTo = to || end_date;

  if (year) {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    const curD = now.getDate();

    if (year === 'all' || year === 'All') {
      finalGranularity = 'yearly';
      finalFrom = '2023-01-01';
      finalTo = `${curY}-${String(curM).padStart(2, '0')}-${String(curD).padStart(2, '0')}`;
    } else {
      const y = Number(year);
      if (!month || month === 'all' || month === 'All') {
        finalGranularity = 'monthly';
        finalFrom = `${y}-01-01`;
        finalTo = (y === curY)
          ? `${y}-${String(curM).padStart(2, '0')}-${String(curD).padStart(2, '0')}`
          : `${y}-12-31`;
      } else {
        finalGranularity = 'daily';
        const m = Number(month);
        finalFrom = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        let endDay = lastDay;
        if (y === curY && m === curM) {
          endDay = Math.min(lastDay, curD);
        }
        finalTo = `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      }
    }
  }

  return {
    granularity: finalGranularity,
    from: finalFrom,
    to: finalTo,
    start_date: finalFrom,
    end_date: finalTo,
    year,
    month,
    period,
    date
  };
};

const getSalesReport = async (req, res, next) => {
  try {
    const params = normalizeReportQuery(req.query);
    const report = await ReportModel.getSalesReport(params);
    res.json(report);
  } catch (error) {
    next(error);
  }
};

const getInventoryReport = async (req, res, next) => {
  try {
    const params = normalizeReportQuery(req.query);
    const report = await ReportModel.getInventoryReport(params);
    res.json(report);
  } catch (error) {
    next(error);
  }
};

const getExpiryReport = async (req, res, next) => {
  try {
    const params = normalizeReportQuery(req.query);
    const report = await ReportModel.getExpiryReport(params);
    res.json(report);
  } catch (error) {
    next(error);
  }
};

const getSupplierReport = async (req, res, next) => {
  try {
    const params = normalizeReportQuery(req.query);
    const report = await ReportModel.getSupplierReport(params);
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
