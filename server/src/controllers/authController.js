const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient, Action } = require('@prisma/client');
const { sendEmail } = require('../services/emailService');
const crypto = require('crypto');
const { getFormattedClientIp } = require('../utils/ipHelper');
const logChanges = require('../utils/auditLog');
require('dotenv').config();

const prisma = new PrismaClient();
const secretKey = process.env.JWT_SECRET;
const otpStore = new Map(); // Temporary storage for OTPs

// Derive an encryption key from JWT_SECRET using PBKDF2
const deriveKey = (saltHex) => {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16); // Use provided salt or generate new
  console.log('Deriving key with salt:', saltHex || salt.toString('hex'));
  const key = crypto.pbkdf2Sync(process.env.JWT_SECRET, salt, 100000, 32, 'sha256');
  return {
    key: key,
    salt: salt.toString('hex')
  };
};

// Encrypt OTP
const encryptOTP = (otp) => {
  const { key, salt } = deriveKey(); // Generate new key with new salt
  console.log('Encrypting OTP:', otp, 'with salt:', salt);
  const iv = crypto.randomBytes(12); // 96 bits IV for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(otp, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  console.log('Encrypted OTP:', encrypted);
  return {
    encryptedOTP: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt // Store the salt for decryption
  };
};

// Decrypt OTP
const decryptOTP = (encryptedData) => {
  const { key } = deriveKey(encryptedData.salt); // Use the stored salt
  console.log('Decrypting with salt:', encryptedData.salt, 'iv:', encryptedData.iv, 'authTag:', encryptedData.authTag);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(encryptedData.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  let decrypted = decipher.update(encryptedData.encryptedOTP, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  console.log('Decrypted OTP:', decrypted);
  return decrypted;
};

const register = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    // Check for existing OTP
    const existingOTP = otpStore.get(email);
    if (existingOTP && existingOTP.type === 'registration') {
      if (Date.now() < existingOTP.expires) {
        // Reuse existing OTP if still valid
        await sendEmail(email, 'Verify Your Email', `Your OTP is ${decryptOTP({ encryptedOTP: existingOTP.encryptedOTP, iv: existingOTP.iv, authTag: existingOTP.authTag, salt: existingOTP.salt })}. It expires in 5 minutes.`);
        return res.json({ success: true });
      } else {
        // Delete expired OTP
        otpStore.delete(email);
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const { encryptedOTP, iv, authTag, salt } = encryptOTP(otp);
    otpStore.set(email, {
      username,
      email,
      password: hashedPassword,
      encryptedOTP,
      iv,
      authTag,
      salt,
      type: 'registration',
      role: 'USER',
      state: 'APPROVED',
      expires: Date.now() + 5 * 60 * 1000
    });
    await sendEmail(email, 'Verify Your Email', `Your OTP is ${otp}. It expires in 5 minutes.`);

    res.json({ success: true });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      //log failed login attempt
      await logChanges(null, Action.LOGIN_FAILED, null, null);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.state === 'PENDING') {
      return res.status(403).json({ success: false, message: 'Your account is pending approval' });
    }
    if (user.state === 'REJECTED') {
      return res.status(403).json({ success: false, message: 'Your account has been rejected' });
    }

    // Get formatted client IP
    const ip = getFormattedClientIp(req);

    // Update the user's last login information
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip
      }
    });
    // Log the successful login
    await logChanges(user.id, Action.LOGIN_SUCCESS, null, null);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, state: user.state },
      secretKey,
      { expiresIn: '24h' }
    );
    res.json({
      success: true,
      token,
      username: user.username,
      role: user.role,
      state: user.state,
      has2fa: user.twoFAEnabled || false,
      requires2FA: user.twoFAEnabled || false
    });
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
  console.log('Verifying OTP for email:', email, 'type:', type, 'storedData:', storedData);
  if (!storedData || storedData.type !== type || Date.now() > storedData.expires) {
    console.log('Validation failed:', !storedData ? 'No stored data' : 'Type mismatch or expired', 'expires:', storedData?.expires, 'now:', Date.now());
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }

  const decryptedOTP = decryptOTP({
    encryptedOTP: storedData.encryptedOTP,
    iv: storedData.iv,
    authTag: storedData.authTag,
    salt: storedData.salt
  });

  console.log('Provided OTP:', otp, 'Decrypted OTP:', decryptedOTP);
  if (decryptedOTP !== otp) {
    console.log('OTP mismatch detected');
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }
  if (type === 'registration') {
    const { username, email, password, role, state } = storedData;
    const user = await prisma.user.create({
      data: { username, email, password, role, state, twoFAEnabled: false },
    });
    const token = jwt.sign({
      id: user.id,
      username: user.username,
      role: user.role,
      state: user.state
    }, secretKey, { expiresIn: '24h' });
    otpStore.delete(email);
    res.json({
      success: true,
      token,
      username: user.username,
      role: user.role,
      state: user.state
    });
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
    const { encryptedOTP, iv, authTag, salt } = encryptOTP(otp);
    otpStore.set(email, { encryptedOTP, iv, authTag, salt, type: 'forgot-password', expires: Date.now() + 5 * 60 * 1000 });
    await sendEmail(email, 'Password Reset OTP', `Your OTP to reset your password is ${otp}. It expires in 5 minutes.`);
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
