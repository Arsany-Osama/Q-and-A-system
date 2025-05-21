const { PrismaClient, Action } = require('@prisma/client');
const DocumentService = require('../services/documentService');
const logChanges = require('../utils/auditLog');

const prisma = new PrismaClient();

const getQuestions = async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      include: {
        user: true,
        answers: {
          include: { user: true },
        },
        documents: true,
      },
    });

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
  try {
    console.log('Question data received:', {
      title: req.body.title,
      contentLength: req.body.content ? req.body.content.length : 'undefined',
      tagsType: typeof req.body.tags,
      userId: req.user.id,
    });

    let { title, content, tags } = req.body;
    const userId = req.user.id;

    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    let tagsArray = [];
    if (tags) {
      if (typeof tags === 'string') {
        try {
          tagsArray = JSON.parse(tags);
        } catch (e) {
          tagsArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
        }
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
    }

    title = title.trim();
    content = content.trim();

    const tagsJson = JSON.stringify(tagsArray);

    const questionData = {
      title,
      content,
      userId,
      tags: tagsJson,
    };

    const question = await prisma.question.create({
      data: questionData,
    });

    //log question creation
    await logChanges(userId,Action.CREATE,'question',question.id);

    res.json({
      success: true,
      question,
    });
  } catch (error) {
    console.error('Error posting question:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      details: error.message,
    });
  }
};

const getPopularTags = async (req, res) => {
  try {
    const questions = await prisma.question.findMany({
      select: {
        tags: true,
      },
    });

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

const createQuestionWithDocument = async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    const file = req.file;
    const userId = req.user.id;

    console.log('Creating question with document:', {
      title,
      contentLength: content ? content.length : 'undefined',
      tags,
      hasFile: !!file,
      userId,
    });

    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }

    let tagsArray = [];
    if (tags) {
      if (typeof tags === 'string') {
        tagsArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
    }

    const question = await prisma.question.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        tags: JSON.stringify(tagsArray),
        userId,
      },
    });

    //log question creation
    await logChanges(userId, Action.CREATE, 'question', question.id);

    let document = null;
    if (file) {
      document = await DocumentService.uploadDocument(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        userId,
        { questionId: question.id }
      );

      //log document creation
      await logChanges(userId, Action.CREATE, 'document', document.id);
    }

    res.status(201).json({
      success: true,
      question: {
        ...question,
        document: document || null,
      },
    });
  } catch (error) {
    console.error('Error creating question with document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create question',
      error: error.message,
    });
  }
};

const getUserQuestions = async (req, res) => {
  try {
    const userId = req.user.id;

    const questions = await prisma.question.findMany({
      where: { userId },
      include: {
        answers: true,
        documents: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const questionsWithTags = questions.map(question => ({
      ...question,
      tags: question.tags ? JSON.parse(question.tags) : [],
    }));

    res.json({ success: true, questions: questionsWithTags });
  } catch (error) {
    console.error('Error fetching user questions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const { title, content, tags } = req.body;
    const userId = req.user.id;

    // Check if question exists and belongs to user
    const question = await prisma.question.findUnique({
      where: { id: parseInt(questionId) }
    });

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    if (question.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this question' });
    }

    let tagsArray = [];
    if (tags) {
      if (typeof tags === 'string') {
        try {
          tagsArray = JSON.parse(tags);
        } catch (e) {
          tagsArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
        }
      } else if (Array.isArray(tags)) {
        tagsArray = tags;
      }
    }

    const updatedQuestion = await prisma.question.update({
      where: { id: parseInt(questionId) },
      data: {
        title: title?.trim(),
        content: content?.trim(),
        tags: JSON.stringify(tagsArray)
      }
    });

    //log question update
    await logChanges(userId, Action.UPDATE, 'question', updatedQuestion.id);

    res.json({ success: true, question: updatedQuestion });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user.id;

    // Check if question exists and belongs to user
    const question = await prisma.question.findUnique({
      where: { id: parseInt(questionId) }
    });

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    if (question.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this question' });
    }

    // Delete all associated answers and documents first
    await prisma.answer.deleteMany({
      where: { questionId: parseInt(questionId) }
    });

    await prisma.document.deleteMany({
      where: { questionId: parseInt(questionId) }
    });

    // Delete the question
    await prisma.question.delete({
      where: { id: parseInt(questionId) }
    });

    //log question deletion
    await logChanges(userId, Action.DELETE, 'question', questionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getQuestions, postQuestion, getPopularTags, createQuestionWithDocument, getUserQuestions, updateQuestion, deleteQuestion };
