const express = require('express');
const { getQuestions, postQuestion } = require('../controllers/questionController');
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Anyone can view questions
router.get('/', getQuestions);

// Only approved users, moderators and admins can post questions
router.post('/', 
  authenticateToken, 
  checkRole(['USER', 'MODERATOR', 'ADMIN']),
  postQuestion
);

module.exports = router;
