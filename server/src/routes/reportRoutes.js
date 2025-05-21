const express = require('express');
const { getReports, report, deleteReportedAnswerOrQuestion, RejectReport } = require('../controllers/reportController');
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Endpoint to get all pending reports
router.get('/', authenticateToken, checkRole(['MODERATOR', 'ADMIN']), getReports);

// Endpoint to report a question or answer
router.post('/report', authenticateToken, report);

// Endpoint to delete a reported question or answer
router.delete('/delete', authenticateToken, checkRole(['MODERATOR', 'ADMIN']), deleteReportedAnswerOrQuestion);

// Endpoint to reject a report if it was valid
router.patch('/reject', authenticateToken, checkRole(['MODERATOR', 'ADMIN']), RejectReport);

module.exports = router;
