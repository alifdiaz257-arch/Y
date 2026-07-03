require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const morgan = require('morgan');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const deployRoutes = require('./routes/deploy');
const projectRoutes = require('./routes/project');

const app = express();

// Create necessary directories
const dirs = ['data', 'uploads', 'builds', 'websites', 'logs', 'public/css', 'public/js', 'public/images'];
dirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Initialize data files if not exist
const dataFiles = {
  'users.json': '[]',
  'projects.json': '[]',
  'sessions.json': '[]'
};

Object.entries(dataFiles).forEach(([file, defaultContent]) => {
  const filePath = path.join(__dirname, 'data', file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, defaultContent);
  }
});

// Logging
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'logs', 'server.log'), 
  { flags: 'a' }
);
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup (if using EJS or similar, adjust accordingly)
app.set('views', path.join(__dirname, 'views'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/projects', projectRoutes);

// Serve deployed websites
app.use('/sites/:projectId', (req, res, next) => {
  const projectId = req.params.projectId;
  const sitePath = path.join(__dirname, 'websites', projectId);
  
  // Check if project exists
  const projectsPath = path.join(__dirname, 'data', 'projects.json');
  const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const project = projects.find(p => p.id === projectId && p.status === 'deployed');
  
  if (!project) {
    return res.status(404).send('Site not found');
  }
  
  express.static(sitePath, {
    index: project.indexFile || 'index.html',
    extensions: ['html', 'htm']
  })(req, res, next);
});

// Wildcard subdomain support (for production)
app.use((req, res, next) => {
  const host = req.hostname;
  const subdomain = host.split('.')[0];
  
  // Skip if it's the main domain
  if (subdomain === 'www' || host === 'localhost' || host === '127.0.0.1') {
    return next();
  }
  
  const sitePath = path.join(__dirname, 'websites', subdomain);
  if (fs.existsSync(sitePath)) {
    express.static(sitePath, {
      index: 'index.html',
      extensions: ['html', 'htm']
    })(req, res, next);
  } else {
    next();
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Log error
  const logStream = fs.createWriteStream(
    path.join(__dirname, 'logs', 'error.log'), 
    { flags: 'a' }
  );
  logStream.write(`${new Date().toISOString()} - ${err.stack}\n`);
  logStream.end();
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Deployed sites available at http://localhost:${PORT}/sites/:projectId`);
});