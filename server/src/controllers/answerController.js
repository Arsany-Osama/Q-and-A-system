const { PrismaClient, Action } = require('@prisma/client');
const logChanges = require('../utils/auditLog');

const prisma = new PrismaClient();

const createAnswer = async (req, res) => {
  console.log("creating answer");
  const { questionId, content } = req.body;
  const userId = req.user.id;
  
  try {
    const answer = await prisma.answer.create({
      data: {
        content,
        questionId: parseInt(questionId),
        userId,
      },
    });
    
    await logChanges(userId, Action.CREATE, 'answer', answer.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getUserAnswers = async (req, res) => {
  try {
    const userId = req.user.id;

    const answers = await prisma.answer.findMany({
      where: { userId },
      include: {
        question: true,
        replies: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ success: true, answers });
  } catch (error) {
    console.error('Error fetching user answers:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateAnswer = async (req, res) => {
  try {
    const { answerId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    // Check if answer exists and belongs to user
    const answer = await prisma.answer.findUnique({
      where: { id: parseInt(answerId) }
    });

    if (!answer) {
      return res.status(404).json({ success: false, message: 'Answer not found' });
    }

    if (answer.userId !== userId) {
      //log unauthorized update
      await logChanges(userId, Action.UNAUTHORIZED_UPDATE, 'answer', answerId);

      return res.status(403).json({ success: false, message: 'Not authorized to update this answer' });
    }

    const updatedAnswer = await prisma.answer.update({
      where: { id: parseInt(answerId) },
      data: { content }
    });

    // Log the answer update
    await logChanges(userId, Action.UPDATE, 'answer', updatedAnswer.id);

    res.json({ success: true, answer: updatedAnswer });
  } catch (error) {
    console.error('Error updating answer:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteAnswer = async (req, res) => {
  try {
    const { answerId } = req.params;
    const userId = req.user.id;

    // Check if answer exists and belongs to user
    const answer = await prisma.answer.findUnique({
      where: { id: parseInt(answerId) }
    });

    if (!answer) {
      return res.status(404).json({ success: false, message: 'Answer not found' });
    }

    if (answer.userId !== userId) {
      //log unauthorized deletion
      await logChanges(userId, Action.UNAUTHORIZED_DELETE, 'answer', answerId);

      return res.status(403).json({ success: false, message: 'Not authorized to delete this answer' });
    }

    // Delete all associated replies first
    await prisma.reply.deleteMany({
      where: { answerId: parseInt(answerId) }
    });

    // Delete the answer
    await prisma.answer.delete({
      where: { id: parseInt(answerId) }
    });
    // Log the answer deletion
    await logChanges(userId, Action.DELETE, 'answer', answerId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting answer:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createAnswer, getUserAnswers, updateAnswer, deleteAnswer };
