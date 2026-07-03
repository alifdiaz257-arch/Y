const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../utils/auth');

// Get all projects for user
router.get('/', authenticateToken, (req, res) => {
  try {
    const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
    const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
    
    const userProjects = projects.filter(p => p.userId === req.userId);
    
    // Remove sensitive data
    const safeProjects = userProjects.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      deployUrl: p.deployUrl,
      fileSize: p.fileSize,
      createdAt: p.createdAt,
      deployedAt: p.deployedAt,
      updatedAt: p.updatedAt
    }));
    
    res.json({ projects: safeProjects });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project
router.get('/:projectId', authenticateToken, (req, res) => {
  try {
    const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
    const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
    
    const project = projects.find(
      p => p.id === req.params.projectId && p.userId === req.userId
    );
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ project });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Delete project
router.delete('/:projectId', authenticateToken, (req, res) => {
  try {
    const { projectId } = req.params;
    const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
    const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
    
    const projectIndex = projects.findIndex(
      p => p.id === projectId && p.userId === req.userId
    );
    
    if (projectIndex === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projects[projectIndex];
    
    // Remove project files
    const dirsToRemove = [
      path.join(__dirname, '..', 'builds', projectId),
      path.join(__dirname, '..', 'websites', projectId)
    ];
    
    dirsToRemove.forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    
    // Remove uploaded file if exists
    if (project.filePath && fs.existsSync(project.filePath)) {
      fs.unlinkSync(project.filePath);
    }
    
    // Remove from database
    projects.splice(projectIndex, 1);
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
    
    res.json({ message: 'Project deleted successfully' });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Redeploy project
router.post('/:projectId/redeploy', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // This would essentially re-run the deploy process
    // For now, just redirect to deploy route logic
    const deployRouter = require('./deploy');
    req.params.projectId = projectId;
    
    return deployRouter.handle(req, res);
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to redeploy project' });
  }
});

module.exports = router;