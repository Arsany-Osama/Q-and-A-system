const documentService = require('../services/documentService');
const { PrismaClient } = require('@prisma/client');
const logChanges = require('../utils/auditLog');

const prisma = new PrismaClient();

const uploadDocument = async (req, res) => {
  try {
    console.log('Uploading document for user:', req.user.id, 'File:', req.file ? req.file.originalname : 'No file');
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const documentData = {
      file: req.file,
      userId: req.user.id,
      metadata: {
        questionId: req.body.questionId ? parseInt(req.body.questionId) : null,
      },
    };

    const document = await documentService.uploadDocument(documentData.file, documentData.userId, documentData.metadata);
    //log document creation
    await logChanges(req.user.id, Action.CREATE, 'document', document.id);
    res.json({ success: true, document });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading document',
      error: error.message,
    });
  }
};

const downloadDocument = async (req, res) => {
  try {
    const { documentId } = req.params; // Changed from id to documentId
    if (!documentId || isNaN(parseInt(documentId))) {
      return res.status(400).json({ success: false, message: 'Document ID is required' });
    }
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const documentData = await documentService.downloadDocument(documentId, req.user.id);
    res.setHeader('Content-Type', documentData.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${documentData.filename}"`);
    res.send(documentData.buffer);
  } catch (error) {
    console.error('Document download error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading document',
      error: error.message,
    });
  }
};

module.exports = { uploadDocument, downloadDocument };
