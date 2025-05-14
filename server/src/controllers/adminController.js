const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getPendingModerators = async (req, res) => {
  try {
    const moderators = await prisma.user.findMany({
      where: {
        role: 'MODERATOR',
        state: 'PENDING'
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        state: true,
        createdAt: true
      }
    });
    
    res.json({ success: true, moderators });
  } catch (error) {
    console.error('Error fetching pending moderators:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateUserStatus = async (req, res) => {
  const userId = req.params.userId;
  const { state } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { state },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        state: true
      }
    });
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateUserRole = async (req, res) => {
  const { userId, role } = req.body;
  
  if (!['USER', 'MODERATOR', 'ADMIN'].includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }
  
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        state: true
      }
    });
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        state: true,
        lastLoginAt: true,
        lastLoginIp: true
      }
    });
    
    // Add debugging for login info
    console.log('User login info:', users.map(u => ({
      id: u.id, 
      username: u.username,
      lastLoginAt: u.lastLoginAt,
      lastLoginIp: u.lastLoginIp
    })));
    
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getLoginLogs = async (req, res) => {
  try {
    // Get all users with login data, ordered by most recent login
    const users = await prisma.user.findMany({
      where: {
        lastLoginAt: { not: null }
      },
      select: {
        id: true,
        username: true,
        email: true,
        lastLoginAt: true,
        lastLoginIp: true
      },
      orderBy: {
        lastLoginAt: 'desc'
      },
      take: 50  // Limit to most recent 50 logins
    });
    
    const logs = users.map(user => ({
      userId: user.id,
      username: user.username,
      email: user.email,
      loginTime: user.lastLoginAt,
      ipAddress: user.lastLoginIp || 'Unknown'
    }));
    
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching login logs:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getPendingModerators,
  updateUserStatus,
  updateUserRole,
  getAllUsers,
  getLoginLogs
};