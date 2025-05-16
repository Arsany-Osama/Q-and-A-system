const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const { authenticateToken } = require('../middleware/authMiddleware');

// Change password route
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // From authentication middleware
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current and new passwords are required' 
      });
    }
    
    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Verify current password
    const passwordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!passwordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update the user's password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });
    
    // Return success
    return res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// New route for updating username
router.post('/update-username', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // From authentication middleware
    const { newUsername, password } = req.body;
    
    // Validate input
    if (!newUsername || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }
    
    // Username validation
    if (newUsername.length < 3 || newUsername.length > 30) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username must be between 3 and 30 characters' 
      });
    }
    
    // Check for valid characters
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username can only contain letters, numbers, and underscores' 
      });
    }
    
    // Find the user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Check if the new username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: newUsername }
    });
    
    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({ 
        success: false, 
        message: 'Username already taken' 
      });
    }
    
    // Verify current password
    const passwordValid = await bcrypt.compare(password, user.password);
    
    if (!passwordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Incorrect password' 
      });
    }
    
    // Update the username
    await prisma.user.update({
      where: { id: userId },
      data: { username: newUsername }
    });
    
    // Return success with the new username
    return res.json({ 
      success: true, 
      message: 'Username updated successfully',
      username: newUsername
    });
  } catch (error) {
    console.error('Update username error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;