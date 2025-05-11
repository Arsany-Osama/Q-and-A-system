const express = require('express');
const { getQuestions, postQuestion, getPopularTags } = require('../controllers/questionController');
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Anyone can view questions
router.get('/', getQuestions);

// Get popular tags
router.get('/popular-tags', getPopularTags);

// Only approved users, moderators and admins can post questions
router.post('/', 
  authenticateToken, 
  checkRole(['USER', 'MODERATOR', 'ADMIN']),
  postQuestion
);

module.exports = router;
