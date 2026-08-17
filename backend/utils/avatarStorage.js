const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'avatars');

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Saves a base64 or file buffer avatar image to disk and returns relative URL path.
 * @param {string} imageData - Base64 data string (e.g. data:image/png;base64,...) or file path/URL
 * @param {number|string} userId - User ID
 * @returns {string} Relative URL path (e.g. /uploads/avatars/avatar-1-1700000000.png)
 */
function saveAvatarImage(imageData, userId) {
  if (!imageData || typeof imageData !== 'string') {
    return null;
  }

  // If already a server relative URL path (starts with /uploads/), return as is
  if (imageData.startsWith('/uploads/')) {
    return imageData;
  }

  // Handle Base64 Data URLs
  const matches = imageData.match(/^data:image\/([a-zA-Z0-9+-]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    // If it's a regular HTTP/HTTPS URL, return it
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      return imageData;
    }
    return null;
  }

  const mimeType = matches[1].toLowerCase();
  const base64Data = matches[2];

  let ext = 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('gif')) ext = 'gif';
  else {
    throw new Error('Unsupported image format. Allowed formats: JPG, JPEG, PNG, WEBP.');
  }

  const fileName = `avatar-${userId}-${Date.now()}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  // Write file to disk synchronously/asynchronously
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buffer);

  console.log(`📸 Avatar saved to disk for user #${userId}: ${filePath}`);
  return `/uploads/avatars/${fileName}`;
}

module.exports = {
  saveAvatarImage,
  UPLOADS_DIR
};
