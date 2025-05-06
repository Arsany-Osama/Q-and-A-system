const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { sendEmail } = require('../services/emailService');
require('dotenv').config();

const prisma = new PrismaClient();
const secretKey = process.env.JWT_SECRET;
const otpStore = new Map(); // Temporary storage for OTPs

const register = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    otpStore.set(email, { username, email, password: hashedPassword, otp, type: 'registration', expires: Date.now() + 10 * 60 * 1000 });
    await sendEmail(email, 'Verify Your Email', `Your OTP is ${otp}. It expires in 10 minutes.`);
    res.json({ success: true });
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
      take: 5
    });

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

const verifyOTP = async (req, res) => {
  const { email, otp, type } = req.body;
  const storedData = otpStore.get(email);
  if (!storedData || storedData.otp !== otp || storedData.type !== type || Date.now() > storedData.expires) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }
  if (type === 'registration') {
    const { username, email, password } = storedData;
    const user = await prisma.user.create({
      data: { username, email, password },
    });
    const token = jwt.sign({ id: user.id, username: user.username }, secretKey, { expiresIn: '1h' });
    otpStore.delete(email);
    res.json({ success: true, token });
  } else if (type === 'forgot-password') {
    const token = jwt.sign({ email }, secretKey, { expiresIn: '10m' }); // Generate a short-lived token
    otpStore.set(email, { ...storedData, verified: true });
    res.json({ success: true, token });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }
    const existingOTP = otpStore.get(email);
    if (existingOTP && existingOTP.type === 'forgot-password') {
      if (Date.now() < existingOTP.expires) {
        // Reuse existing OTP if still valid
        return res.json({ success: true });
      } else if (existingOTP.verified) {
        // Keep the verified OTP if it exists, even if expired
        return res.json({ success: true });
      } else {
        // Only delete if not verified and expired
        otpStore.delete(email);
      }
    }
    // Generate and send a new OTP if no valid or verified OTP exists
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, type: 'forgot-password', expires: Date.now() + 10 * 60 * 1000 });
    await sendEmail(email, 'Password Reset OTP', `Your OTP to reset your password is ${otp}. It expires in 10 minutes.`);
    res.json({ success: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  console.log('Reset password request with token:', token);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    console.log('otpStore state:', Object.fromEntries(otpStore));
    const storedData = otpStore.get(email);
    if (!storedData || storedData.type !== 'forgot-password' || !storedData.verified) {
      console.log('OTP validation failed:', { storedData, email });
      return res.status(400).json({ success: false, message: 'Invalid or unverified OTP' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });
    otpStore.delete(email); // Clear only after successful reset
    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { register, login, logout, getUserStats, getTopContributors, verifyOTP, forgotPassword, resetPassword };
