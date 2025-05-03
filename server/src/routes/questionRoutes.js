const express = require('express');
const { getQuestions, postQuestion } = require('../controllers/questionController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getQuestions);
router.post('/', authenticateToken, postQuestion);

module.exports = router;
