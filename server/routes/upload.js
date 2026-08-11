const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};

const docFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only images and PDFs are allowed'));
};

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadDoc = multer({
  storage,
  fileFilter: docFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB for docs
});

// POST /api/upload — authenticated users can upload an image
router.post('/', protect, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({ url: `/api/upload/${req.file.filename}` });
});

// POST /api/upload/doc — upload a verification document (PDF or image)
router.post('/doc', protect, uploadDoc.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({ url: `/api/upload/${req.file.filename}`, name: req.file.originalname });
});

// GET /api/upload/:filename
router.get('/:filename', (req, res) => {
  const safe = path.basename(req.params.filename);
  const ext = path.extname(safe).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'].includes(ext)) {
    return res.status(400).json({ message: 'Invalid file type' });
  }
  const filePath = path.join(uploadDir, safe);
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).json({ message: 'File not found' });
  });
});

module.exports = router;
