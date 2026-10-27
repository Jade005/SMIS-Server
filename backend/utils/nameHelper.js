/**
 * Name & Email Utilities for SMIS
 */

/**
 * Auto-generate middle initial from middle name.
 * - Takes the first letter, uppercases it, and adds a period (e.g. "Santos" -> "S.").
 * - Trims spaces and ignores leading special characters.
 * - If empty or no valid letter, returns empty string.
 */
function getMiddleInitial(middleName) {
  if (!middleName) return '';
  const trimmed = String(middleName).trim();
  const match = trimmed.match(/[a-zA-Z]/);
  if (!match) return '';
  return `${match[0].toUpperCase()}.`;
}

/**
 * Format & capitalize name parts (words separated by whitespace or hyphens).
 * Disallows invalid characters, allows letters, spaces, hyphens, and periods only, max 50 chars.
 */
function sanitizeMiddleName(middleName) {
  if (!middleName) return '';
  const sanitized = String(middleName)
    .replace(/[^a-zA-Z\s\-\.]/g, '')
    .slice(0, 50);

  // Capitalize first letter of each part
  return sanitized.replace(/\b([a-z])/g, (char) => char.toUpperCase()).trim();
}

/**
 * Consistent customer display name helper: "First M. Last" (e.g. "Kevin E. Esto")
 * If no middle initial or middle name, returns "First Last" without stray periods or double spaces.
 */
function getDisplayName(user) {
  if (!user) return '';

  if (typeof user === 'string') {
    return user.trim();
  }

  const first = (user.first_name || '').trim();
  const last = (user.last_name || '').trim();

  let mi = (user.middle_initial || '').trim();
  if (!mi && user.middle_name) {
    mi = getMiddleInitial(user.middle_name);
  } else if (mi) {
    const match = mi.match(/[a-zA-Z]/);
    mi = match ? `${match[0].toUpperCase()}.` : '';
  }

  if (first && last) {
    return mi ? `${first} ${mi} ${last}` : `${first} ${last}`;
  }
  if (first) {
    return mi ? `${first} ${mi}` : first;
  }
  if (last) {
    return last;
  }

  return (user.customer_name || user.full_name || user.name || user.username || '').trim();
}

/**
 * Generate unique system email (first.last@smis.local, first.last2@smis.local, etc.)
 */
async function generateUniqueSystemEmail(firstName, lastName, dbQuery, excludeUserId = null) {
  const cleanFirst = String(firstName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'customer';
  const cleanLast = String(lastName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const basePrefix = cleanLast ? `${cleanFirst}.${cleanLast}` : cleanFirst;

  let candidate = `${basePrefix}@smis.local`;
  let counter = 1;

  while (true) {
    let checkSql = 'SELECT id FROM users WHERE email = ?';
    const params = [candidate];
    if (excludeUserId) {
      checkSql += ' AND id != ?';
      params.push(excludeUserId);
    }
    const userRows = await dbQuery(checkSql, params);

    // Also check pending_registrations
    const pendingRows = await dbQuery('SELECT id FROM pending_registrations WHERE email = ? AND status = ?', [candidate, 'pending']);

    if (userRows.length === 0 && pendingRows.length === 0) {
      return candidate;
    }

    counter += 1;
    candidate = `${basePrefix}${counter}@smis.local`;
  }
}

module.exports = {
  getMiddleInitial,
  sanitizeMiddleName,
  getDisplayName,
  generateUniqueSystemEmail
};
