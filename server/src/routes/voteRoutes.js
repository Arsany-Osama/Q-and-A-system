const express = require('express');
const { voteQuestion, voteAnswer } = require('../controllers/voteController');
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Vote on a question - allow approved users, moderators and admins
router.post('/question', 
  authenticateToken,
  checkRole(['USER', 'MODERATOR', 'ADMIN']),
  (req, res) => {
    console.log('Received request to vote on question:', req.body);
    voteQuestion(req, res);
  }
);

// Vote on an answer - allow approved users, moderators and admins
router.post('/answer', 
  authenticateToken,
  checkRole(['USER', 'MODERATOR', 'ADMIN']),
  (req, res) => {
    console.log('Received request to vote on answer:', req.body);
    voteAnswer(req, res);
  }
);

     module.exports = router;
