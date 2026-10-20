/**
 * Helper to resolve date ranges and build continuous X-axis buckets for reports.
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Returns validated `from` and `to` strings (YYYY-MM-DD) based on granularity.
 */
function resolveDateRange({ granularity = 'daily', from, to }) {
  const cleanGranularity = ['daily', 'monthly', 'yearly'].includes(granularity)
    ? granularity
    : 'daily';

  const today = new Date();
  let defaultFrom = '';
  let defaultTo = formatDate(today);

  if (cleanGranularity === 'daily') {
    const d = new Date(today);
    d.setDate(d.getDate() - 13); // 14 days including today
    defaultFrom = formatDate(d);
  } else if (cleanGranularity === 'monthly') {
    const d = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    defaultFrom = formatDate(d);
  } else if (cleanGranularity === 'yearly') {
    const d = new Date(today.getFullYear() - 4, 0, 1);
    defaultFrom = formatDate(d);
  }

  const finalFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : defaultFrom;
  const finalTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : defaultTo;

  return {
    granularity: cleanGranularity,
    from: finalFrom <= finalTo ? finalFrom : finalTo,
    to: finalFrom <= finalTo ? finalTo : finalFrom
  };
}

/**
 * Generates continuous empty buckets between `from` and `to`.
 */
function generateContinuousBuckets(from, to, granularity) {
  const buckets = [];
  const [startY, startM, startD] = from.split('-').map(Number);
  const [endY, endM, endD] = to.split('-').map(Number);

  if (granularity === 'daily') {
    const curr = new Date(startY, startM - 1, startD);
    const end = new Date(endY, endM - 1, endD);

    // Limit to reasonable maximum (e.g. 366 days) to prevent infinite loops
    let count = 0;
    while (curr <= end && count < 1000) {
      const key = formatDate(curr);
      const label = `${curr.getMonth() + 1}/${curr.getDate()}`;
      buckets.push({ key, label });
      curr.setDate(curr.getDate() + 1);
      count++;
    }
  } else if (granularity === 'monthly') {
    let y = startY;
    let m = startM; // 1-12

    let count = 0;
    while ((y < endY || (y === endY && m <= endM)) && count < 240) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[m - 1]} ${y}`;
      buckets.push({ key, label });

      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
      count++;
    }
  } else if (granularity === 'yearly') {
    let y = startY;
    let count = 0;
    while (y <= endY && count < 50) {
      const key = String(y);
      const label = String(y);
      buckets.push({ key, label });
      y++;
      count++;
    }
  }

  return buckets;
}

module.exports = {
  formatDate,
  resolveDateRange,
  generateContinuousBuckets
};
