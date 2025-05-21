const express = require('express');
const { 
  getQuestions, 
  postQuestion, 
  getPopularTags, 
  createQuestionWithDocument, 
  getUserQuestions,
  updateQuestion,
  deleteQuestion
} = require('../controllers/questionController');
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', getQuestions);
router.get('/popular-tags', getPopularTags);
router.get('/user', authenticateToken, getUserQuestions);
router.post('/', authenticateToken, checkRole(['USER', 'MODERATOR', 'ADMIN']), postQuestion);
router.post('/with-document', authenticateToken, checkRole(['USER', 'MODERATOR', 'ADMIN']), upload.single('document'), createQuestionWithDocument);
router.put('/:questionId', authenticateToken, updateQuestion);
router.delete('/:questionId', authenticateToken, deleteQuestion);

module.exports = router;
