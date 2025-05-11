const express = require('express');
const multer = require('multer');
const path = require('path');
const { getQuestions, postQuestion, getPopularTags } = require('../controllers/questionController');
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const stream = require('stream');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Use memory storage for initial file handling
const memoryStorage = multer.memoryStorage();
const memoryUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only doc, docx, pdf, txt files based on MIME type
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/msword', // doc
      'application/pdf',
      'text/plain'
    ];
    
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
    
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.doc', '.docx', '.txt'];
    
    if (!allowedExts.includes(ext)) {
      return cb(new Error(`Unsupported file extension: ${ext}`), false);
    }
    
    cb(null, true);
  }
});

// Anyone can view questions
router.get('/', getQuestions);

// Get popular tags
router.get('/popular-tags', getPopularTags);

// Only approved users, moderators and admins can post questions
router.post('/', 
  authenticateToken, 
  checkRole(['USER', 'MODERATOR', 'ADMIN']),
  (req, res, next) => {
    memoryUpload.single('document')(req, res, async (err) => {
      if (err) {
        console.error('Multer error during upload:', err);
        return res.status(400).json({ 
          success: false, 
          message: 'File upload error', 
          details: err.message 
        });
      }
      
      // If no file was uploaded, continue to the next middleware
      if (!req.file) {
        return next();
      }
      
      try {
        // Basic MIME type validation has already been done by multer
        const fileExt = path.extname(req.file.originalname).substring(1).toLowerCase();
        
        // Create a readable stream from the buffer
        const bufferStream = new stream.PassThrough();
        bufferStream.end(req.file.buffer);
        
        // Generate a sanitized filename
        const filenameWithoutExt = req.file.originalname.replace(path.extname(req.file.originalname), '');
        const sanitizedFilename = filenameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const publicId = `qa-documents/${sanitizedFilename}-${uniqueSuffix}`;
        
        // Upload directly to Cloudinary using the stream API
        const uploadPromise = new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              resource_type: 'raw', // Use 'raw' for documents
              public_id: publicId,
              format: fileExt,
              use_filename: true,
              unique_filename: true,
              overwrite: false
            },
            (error, result) => {
              if (error) {
                console.error('Cloudinary upload error:', error);
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          
          bufferStream.pipe(uploadStream);
        });
        
        const uploadResult = await uploadPromise;
        
        // Add the upload result to the request object
        req.fileUrl = uploadResult.secure_url;
        req.filePublicId = uploadResult.public_id;
        
        next();
      } catch (error) {
        console.error('Error processing file upload:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        
        return res.status(500).json({
          success: false,
          message: 'Server error during file upload',
          details: error.message
        });
      }
    });
  },
  postQuestion
);

module.exports = router;
