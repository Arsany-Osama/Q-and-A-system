const express = require('express');
const { createAnswer, getUserAnswers, updateAnswer, deleteAnswer } = require('../controllers/answerController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/user', authenticateToken, getUserAnswers);
router.post('/', authenticateToken, createAnswer);
router.put('/:answerId', authenticateToken, updateAnswer);
router.delete('/:answerId', authenticateToken, deleteAnswer);

module.exports = router;
