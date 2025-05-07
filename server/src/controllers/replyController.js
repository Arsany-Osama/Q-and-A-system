const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createReply = async (req, res) => {
  const { answerId, content, mentionedUserId } = req.body;
  const userId = req.user.id;
  
  try {
    // Check if answer exists
    const answer = await prisma.answer.findUnique({
      where: { id: parseInt(answerId) },
      include: { user: true }
    });
    
    if (!answer) {
      return res.status(404).json({ success: false, message: 'Answer not found' });
    }

    const reply = await prisma.reply.create({
      data: {
        content,
        answerId: parseInt(answerId),
        userId,
        mentionedUserId: mentionedUserId ? parseInt(mentionedUserId) : null,
      },
      include: {
        user: true,
        mentionedUser: true
      }
    });
    
    res.json({ 
      success: true, 
      reply: {
        ...reply,
        username: reply.user.username,
        mentionedUsername: reply.mentionedUser?.username
      }
    });
  } catch (error) {
    console.error('Error creating reply:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getReplies = async (req, res) => {
  const { answerId } = req.params;
  
  try {
    const replies = await prisma.reply.findMany({
      where: { answerId: parseInt(answerId) },
      include: {
        user: true,
        mentionedUser: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    const formattedReplies = replies.map(reply => ({
      ...reply,
      username: reply.user.username,
      mentionedUsername: reply.mentionedUser?.username
    }));
    
    res.json({ success: true, replies: formattedReplies });
  } catch (error) {
    console.error('Error fetching replies:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createReply, getReplies };