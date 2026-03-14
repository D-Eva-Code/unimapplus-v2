const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const path = require('path');

// Configure Cloudinary — add these to your .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Store files in memory so we can stream to Cloudinary
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedExt = /jpeg|jpg|png|webp|jfif|avif/;
    const allowedMime = /image\//; // accept any image/* mimetype
    const ok = allowedExt.test(path.extname(file.originalname).toLowerCase()) || allowedMime.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Only image files allowed'));
  },
});

// Helper — call this in your controller after multer runs
async function uploadToCloudinary(buffer, folder = 'unimapplus') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
      (error, result) => error ? reject(error) : resolve(result.secure_url)
    );
    stream.end(buffer);
  });
}

module.exports = { upload, uploadToCloudinary };
