const { PrismaClient } = require('@prisma/client');
const path = require('path');

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
  try {
    // Log the received data for debugging
    console.log('Question data received:', {
      title: req.body.title,
      contentLength: req.body.content ? req.body.content.length : 'undefined',
      tagsType: typeof req.body.tags,
      userId: req.user.id,
      file: req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file'
    });

    // Get title and content directly from req.body
    let { title, content } = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    
    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }
    
    // Handle tags processing
    let tags = [];
    if (req.body.tags) {
      if (typeof req.body.tags === 'string') {
        try {
          // Try to parse as JSON string (from FormData)
          tags = JSON.parse(req.body.tags);
        } catch (e) {
          // If parsing fails, assume comma-separated string
          tags = req.body.tags.split(',').map(tag => tag.trim()).filter(Boolean);
        }
      } else if (Array.isArray(req.body.tags)) {
        // Direct array (from JSON body)
        tags = req.body.tags;
      }
    }
    
    // Ensure all values are trimmed strings
    title = title.trim();
    content = content.trim();
    
    // Serialize tags array to JSON string
    const tagsJson = JSON.stringify(tags);

    // Create question data object
    const questionData = {
      title,
      content,
      userId,
      tags: tagsJson,
    };

    // If there's an uploaded file, add the document path from Cloudinary
    if (req.fileUrl) {
      // Store the Cloudinary URL
      questionData.documentPath = req.fileUrl;
      
      // Store the original filename separately to ensure we have it for reference
      questionData.originalFilename = req.file.originalname;
      
      // Add file extension info for debugging
      const fileExtension = path.extname(req.file.originalname);
      
      // Log detailed file information
      console.log('File upload details:');
      console.log(`Original filename: ${req.file.originalname}`);
      console.log(`File extension: ${fileExtension}`);
      console.log(`Cloudinary URL: ${req.fileUrl}`);
      console.log(`Cloudinary public ID: ${req.filePublicId}`);
      console.log(`Mime type: ${req.file.mimetype}`);
    }

    const question = await prisma.question.create({
      data: questionData
    });

    res.json({ 
      success: true, 
      question,
      documentPath: questionData.documentPath || null,
      originalFilename: questionData.originalFilename || null
    });
  } catch (error) {
    console.error('Error posting question:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      details: error.message 
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
