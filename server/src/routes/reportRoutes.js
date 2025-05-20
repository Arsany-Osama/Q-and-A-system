const { Prisma } = require('@prisma/client');
const express = require('express');
const { getReports, report, deleteReportedAnswerOrQuestion, RejectReport } = require('../controllers/reportController');
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');

const router = express.Router();

//endpoint to get all pending reports
router.get('/', authenticateToken, checkRole(['MODERATOR', 'ADMIN']), getReports);

//endpoint to report a question or answer
router.post('/report', authenticateToken, report);

//endpoint to delete a reported question or answer
router.delete('/delete', authenticateToken, checkRole(['ADMIN']), deleteReportedAnswerOrQuestion);

//endpoint to reject a report if it was valid
router.patch('/reject', authenticateToken, checkRole(['ADMIN']), RejectReport);

module.exports = router;