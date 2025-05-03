const express = require('express');
const { createAnswer } = require('../controllers/answerController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authenticateToken, createAnswer);

module.exports = router;
