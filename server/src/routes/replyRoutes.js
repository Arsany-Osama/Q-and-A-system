const express = require('express');
const router = express.Router();
const { createReply, getReplies } = require('../controllers/replyController');
// Import your custom JWT authentication middleware
const { authenticateToken } = require('../middleware/authMiddleware');

// Reply routes
router.post('/', authenticateToken, createReply);
router.get('/:answerId', getReplies);

module.exports = router;