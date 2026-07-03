const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

// Read users from JSON file
function getUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Save users to JSON file
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Find user by email
function findUserByEmail(email) {
  const users = getUsers();
  return users.find(user => user.email === email);
}

// Find user by ID
function findUserById(id) {
  const users = getUsers();
  return users.find(user => user.id === id);
}

// Create user
async function createUser(username, email, password) {
  const users = getUsers();
  
  // Check if user exists
  if (findUserByEmail(email)) {
    throw new Error('User already exists');
  }
  
  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  
  const newUser = {
    id: generateId(users),
    username,
    email,
    password: hashedPassword,
    createdAt: new Date().toISOString()
  };
  
  users.push(newUser);
  saveUsers(users);
  
  return { id: newUser.id, username: newUser.username, email: newUser.email };
}

// Generate unique ID
function generateId(users) {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Authenticate user
async function authenticateUser(email, password) {
  const user = findUserByEmail(email);
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  const isMatch = await bcrypt.compare(password, user.password);
  
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }
  
  return { id: user.id, username: user.username, email: user.email };
}

// Generate JWT token
function generateToken(userId) {
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
}

// Verify token
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// Middleware to authenticate token
function authenticateToken(req, res, next) {
  const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    req.user = findUserById(decoded.userId);
    
    if (!req.user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  authenticateUser,
  generateToken,
  verifyToken,
  authenticateToken
};