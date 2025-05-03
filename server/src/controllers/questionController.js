const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const getQuestions = async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        user: true,
        answers: {
          include: { user: true },
        },
      },
    });

    // Deserialize tags from JSON string to array
    const questionsWithTags = questions.map(question => ({
      ...question,
      tags: question.tags ? JSON.parse(question.tags) : [],
    }));

    res.json(questionsWithTags);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const postQuestion = async (req, res) => {
  const { title, content, tags } = req.body;
  const userId = req.user.id;

  try {
    // Serialize tags array to JSON string
    const tagsJson = tags ? JSON.stringify(tags) : JSON.stringify([]);

    const question = await prisma.question.create({
      data: {
        title,
        content,
        userId,
        tags: tagsJson,
      },
    });

    res.json({ success: true, question });
  } catch (error) {
    console.error('Error posting question:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getQuestions, postQuestion };
