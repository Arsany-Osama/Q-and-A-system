const express = require('express');
     const { voteQuestion, voteAnswer } = require('../controllers/voteController');
     const { authenticateToken } = require('../middleware/authMiddleware');

     const router = express.Router();

     // Vote on a question
     router.post('/question', authenticateToken, (req, res) => {
       console.log('Received request to vote on question:', req.body);
       voteQuestion(req, res);
     });

     // Vote on an answer
     router.post('/answer', authenticateToken, (req, res) => {
       console.log('Received request to vote on answer:', req.body);
       voteAnswer(req, res);
     });

     module.exports = router;
