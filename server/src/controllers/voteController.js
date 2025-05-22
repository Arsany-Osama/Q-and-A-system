const { PrismaClient, Action } = require('@prisma/client');
const logChanges = require('../utils/auditLog');

const prisma = new PrismaClient();

const voteQuestion = async (req, res) => {
  const { questionId, voteType } = req.body;
  const userId = req.user.id;

  try {
    // Check if user already voted
    const existingVote = await prisma.vote.findFirst({
      where: { userId, questionId },
    });

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        return res.status(400).json({ success: false, message: 'Already voted this way' });
      }
      // Update vote
      await prisma.vote.update({
        where: { id: existingVote.id },
        data: { voteType },
      });


    } else {
      // Create new vote
      await prisma.vote.create({
        data: { userId, questionId, voteType },
      });
    }    
    // log the vote
    const action = voteType === 'upvote' ? Action.VOTE_UP : Action.VOTE_DOWN;
    await logChanges(userId, action, 'question', questionId);

    // Update question vote counts
    const upvotes = await prisma.vote.count({ where: { questionId, voteType: 'upvote' } });
    const downvotes = await prisma.vote.count({ where: { questionId, voteType: 'downvote' } });

    await prisma.question.update({
      where: { id: parseInt(questionId) },
      data: { upvotes, downvotes },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error voting on question:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const voteAnswer = async (req, res) => {
  const { answerId, voteType } = req.body;
  const userId = req.user.id;

  try {
    // Check if user already voted on this answer
    const existingVote = await prisma.vote.findFirst({
      where: { userId, answerId },
    });

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        return res.status(400).json({ success: false, message: 'Already voted this way' });
      }
      // Update vote
      await prisma.vote.update({
        where: { id: existingVote.id },
        data: { voteType },
      });    } else {
      // Create new vote
      await prisma.vote.create({
        data: { userId, answerId, voteType },      });    }
    // log the vote
    const action = voteType === 'upvote' ? Action.VOTE_UP : Action.VOTE_DOWN;
    await logChanges(userId, action, 'answer', answerId);

    // Update answer vote counts
    const upvotes = await prisma.vote.count({ where: { answerId, voteType: 'upvote' } });
    const downvotes = await prisma.vote.count({ where: { answerId, voteType: 'downvote' } });

    await prisma.answer.update({
      where: { id: parseInt(answerId) },
      data: { upvotes, downvotes },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error voting on answer:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { voteQuestion, voteAnswer };

