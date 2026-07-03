const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../utils/auth');
const { validateZip } = require('../utils/unzip');

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/zip' || 
      file.mimetype === 'application/x-zip-compressed' ||
      path.extname(file.originalname).toLowerCase() === '.zip') {
    cb(null, true);
  } else {
    cb(new Error('Only ZIP files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024 // 50MB
  }
});

// Upload ZIP file
router.post('/', authenticateToken, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    try {
      // Validate ZIP file
      await validateZip(req.file.path);
      
      // Create project record
      const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
      const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
      
      const projectId = String(projects.length + 1).padStart(5, '0');
      
      const project = {
        id: projectId,
        userId: req.userId,
        name: req.body.name || path.basename(req.file.originalname, '.zip'),
        originalName: req.file.originalname,
        fileName: req.file.filename,
        fileSize: req.file.size,
        filePath: req.file.path,
        status: 'uploaded',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      projects.push(project);
      fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
      
      res.status(201).json({
        message: 'File uploaded successfully',
        project
      });
      
    } catch (error) {
      // Delete uploaded file if validation fails
      fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: error.message });
    }
  });
});

module.exports = router;