const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');

const userRouter = express.Router();

// Register user
userRouter.post('/register', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  
  // Get users collection from app
  const usersCollection = req.app.get('usersCollection');
  
  // Check if user already exists
  const existingUser = await usersCollection.findOne({ username });
  if (existingUser) {
    return res.status(400).json({
      message: 'error',
      payload: 'User already exists'
    });
  }
  
  // Hash password
  const hashedPassword = await bcryptjs.hash(password, 10);
  
  // Create new user
  const newUser = {
    username,
    password: hashedPassword,
    usertype: 'user', // Default to user
    createdAt: new Date()
  };
  
  // Insert user into database
  const result = await usersCollection.insertOne(newUser);
  
  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: result.insertedId, 
      username: username,
      usertype: 'user'
    },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '24h' }
  );
  
  // Remove password from user object before sending
  const userResponse = {
    id: result.insertedId,
    username,
    usertype: 'user'
  };
  
  res.status(201).json({
    message: 'success',
    payload: {
      user: userResponse,
      token
    }
  });
}));

// Login user
userRouter.post('/login', asyncHandler(async (req, res) => {
  const { username, password, usertype } = req.body;
  
  // Get users collection from app
  const usersCollection = req.app.get('usersCollection');
  
  // Find user by username
  const user = await usersCollection.findOne({ username });
  if (!user) {
    return res.status(401).json({
      message: 'error',
      payload: 'Invalid credentials'
    });
  }
  
  // Check password
  const isPasswordValid = await bcryptjs.compare(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({
      message: 'error',
      payload: 'Invalid credentials'
    });
  }
  
  // Check usertype if provided (for admin access)
  if (usertype && usertype === 'admin' && user.usertype !== 'admin') {
    return res.status(403).json({
      message: 'error',
      payload: 'Access denied. Admin privileges required.'
    });
  }
  
  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: user._id, 
      username: user.username,
      usertype: user.usertype || 'user'
    },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '24h' }
  );
  
  // Remove password from user object before sending
  const userResponse = {
    id: user._id,
    username: user.username,
    usertype: user.usertype || 'user'
  };
  
  res.json({
    message: 'success',
    payload: {
      user: userResponse,
      token
    }
  });
}));

module.exports = userRouter;
