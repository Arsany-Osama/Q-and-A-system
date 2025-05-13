const express = require('express');
const router = express.Router();
const multer = require('multer');
const documentController = require('../controllers/documentController');
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');

// Configure Multer to use memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Only approved users, moderators, and admins can upload documents
router.post(
  '/upload',
  authenticateToken,
  checkRole(['USER', 'MODERATOR', 'ADMIN']),
  upload.single('document'),
  documentController.uploadDocument
);

// Only approved users, moderators, and admins can download documents
router.get(
  '/download/:documentId',
  authenticateToken,
  checkRole(['USER', 'MODERATOR', 'ADMIN']),
  documentController.downloadDocument
);

module.exports = router;
