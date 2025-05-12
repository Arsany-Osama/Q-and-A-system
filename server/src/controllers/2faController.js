const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

/**
 * Generate 2FA secret and QR code
 */
exports.generate2FA = async (req, res) => {
  try {
    // Debugging: Log incoming request
    console.log('Generate 2FA Request:', {
      userId: req.user?.id,
      email: req.user?.email
    });

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: encodeURIComponent(`Q&A Hub:${user.email}`),
      issuer: 'Q&A Hub',
      length: 32
    });

    // Debug: Log secret generation
    console.log('Generated Secret:', {
      base32: secret.base32,
      otpauth_url: secret.otpauth_url
    });

    // Save to database
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        twoFASecret: secret.base32,
        twoFAEnabled: false
      }
    });

    // Generate QR code
    const qrCode = await qrcode.toDataURL(secret.otpauth_url);
    
    // Debug: Verify QR code generation
    console.log('QR Code generated successfully');

    return res.json({
      success: true,
      qr: qrCode,
      secret: secret.base32,
      manualEntry: secret.otpauth_url
    });

  } catch (error) {
    console.error('Full 2FA Generation Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({
      success: false,
      message: '2FA setup failed - please try again',
      systemError: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Verify 2FA token
 */
exports.verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { twoFASecret: true }
    });
    if (!userRecord || !userRecord.twoFASecret) {
      return res.status(400).json({ success: false, message: '2FA not setup for this user' });
    }

    const verified = speakeasy.totp.verify({
      secret: userRecord.twoFASecret,
      encoding: 'base32',
      token,
      window: 2
    });
    if (!verified) {
      return res.status(401).json({ success: false, message: 'Invalid 2FA token' });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { twoFAEnabled: true }
    });

    const newToken = jwt.sign(
      {
        id:       req.user.id,
        username: req.user.username,
        role:     req.user.role,
        state:    req.user.state
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.json({
      success: true,
      message: '2FA verified successfully',
      token:    newToken,
      username: req.user.username,
      role:     req.user.role,
      state:    req.user.state,
      has2fa:   true
    });
  } catch (error) {
    console.error('2FA Verification Error:', {
      message: error.message,
      stack:   error.stack,
      timestamp: new Date().toISOString()
    });
    return res.status(500).json({
      success: false,
      message: 'Error verifying 2FA token',
      systemError: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Disable 2FA for user
 */
exports.disable2FA = async (req, res) => {
  try {    
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        twoFASecret: null,
        twoFAEnabled: false
      }
    });

    return res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    console.error('Disable 2FA Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({
      success: false,
      message: 'Error disabling 2FA',
      systemError: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Check if 2FA is enabled for user
 */
exports.check2FAStatus = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { twoFAEnabled: true }
    });

    return res.json({
      success: true,
      isEnabled: user?.twoFAEnabled || false
    });
  } catch (error) {
    console.error('Check 2FA Status Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking 2FA status'
    });
  }
};