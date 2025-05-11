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

const getPopularTags = async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      select: {
        tags: true,
      },
    });

    // Parse all tags and count occurrences
    const tagCounts = {};
    
    questions.forEach(question => {
      if (!question.tags) return;
      
      let tags = [];
      try {
        tags = JSON.parse(question.tags);
      } catch (e) {
        console.warn('Invalid tags format:', question.tags);
        return;
      }
      
      tags.forEach(tag => {
        if (tag && tag.trim()) {
          const cleanTag = tag.trim().toLowerCase();
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        }
      });
    });
    
    // Convert to array, sort by count, and take top tags
    const popularTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    res.json(popularTags);
  } catch (error) {
    console.error('Error fetching popular tags:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getQuestions, postQuestion, getPopularTags };
