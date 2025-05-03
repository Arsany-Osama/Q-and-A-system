const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const createAnswer = async (req, res) => {
  const { questionId, content } = req.body;
  const userId = req.user.id;
  try {
    await prisma.answer.create({
      data: {
        content,
        questionId: parseInt(questionId),
        userId,
      },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createAnswer };
