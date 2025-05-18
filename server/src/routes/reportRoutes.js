import { Prisma } from '@prisma/client';
import Router from 'express';
import { getReports, report, deleteReportedAnswerOrQuestion, RejectReport } from '../controllers/reportController';

const router = Router();

//endpoint to get all pending reports
router.get('/',authenticateToken, checkRole(['MODERATOR', 'ADMIN)']), getReports);

//endpoint to report a question or answer
router.post('/report', authenticateToken, report);
export default router;

//endpoint to delete a reported question or answer
router.delete('/delete', authenticateToken, checkRole("Admin"), deleteReportedAnswerOrQuestion);

//endpoint to reject a report if it was valid
router.patch('/reject', authenticateToken, checkRole("Admin"), RejectReport);