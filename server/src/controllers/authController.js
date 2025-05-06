const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const secretKey = process.env.JWT_SECRET;

const register = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, password: hashedPassword },
    });
    const token = jwt.sign({ id: user.id, username: user.username }, secretKey, { expiresIn: '1h' });
    res.json({ success: true, token, username: user.username });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, secretKey, { expiresIn: '1h' });
    res.json({ success: true, token, username: user.username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const logout = (req, res) => {
  console.log('Logout request received for user:', req.user);
  // With JWT, there's no server-side session to invalidate, but you could implement a token blacklist
  res.json({ success: true });
};

const getUserStats = async (req, res) => {
  const userId = req.user.id;

  try {
    const questions = await prisma.question.findMany({
      where: { userId },
      select: { id: true },
    });
    const answers = await prisma.answer.findMany({
      where: { userId },
      select: { id: true },
    });

    res.json({
      success: true,
      stats: {
        questionsCount: questions.length,
        answersCount: answers.length,
      },
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getTopContributors = async (req, res) => {
  try {
    // Group answers by userId and count them
    const userAnswerCounts = await prisma.answer.groupBy({
      by: ['userId'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5 // Limit to top 5 contributors
    });

    // Fetch user details for these contributors
    const topContributors = await Promise.all(
      userAnswerCounts.map(async (item) => {
        const user = await prisma.user.findUnique({
          where: { id: item.userId },
          select: { id: true, username: true }
        });
        
        return {
          id: user.id,
          username: user.username,
          answerCount: item._count.id
        };
      })
    );

    res.json({ success: true, contributors: topContributors });
  } catch (error) {
    console.error('Error fetching top contributors:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { register, login, logout, getUserStats, getTopContributors };
