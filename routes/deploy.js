const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../utils/auth');
const { unzipFile } = require('../utils/unzip');
const { runBuild } = require('../utils/build');
const { deployBuild } = require('../utils/deploy');

// Deploy project
router.post('/:projectId/deploy', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Get project from database
    const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
    const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
    const projectIndex = projects.findIndex(p => p.id === projectId && p.userId === req.userId);
    
    if (projectIndex === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = projects[projectIndex];
    
    if (!fs.existsSync(project.filePath)) {
      return res.status(404).json({ error: 'Uploaded file not found. Please re-upload.' });
    }
    
    // Update project status
    projects[projectIndex].status = 'extracting';
    projects[projectIndex].updatedAt = new Date().toISOString();
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
    
    // Step 1: Extract ZIP
    const extractDir = path.join(__dirname, '..', 'builds', projectId);
    await unzipFile(project.filePath, extractDir);
    
    // Update status
    projects[projectIndex].status = 'building';
    projects[projectIndex].updatedAt = new Date().toISOString();
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
    
    // Step 2: Build if needed
    const buildResult = await runBuild(extractDir);
    
    // Update status
    projects[projectIndex].status = 'deploying';
    projects[projectIndex].updatedAt = new Date().toISOString();
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
    
    // Step 3: Deploy
    const deployDir = path.join(__dirname, '..', 'websites', projectId);
    await deployBuild(buildResult.outputDir, deployDir, { force: true });
    
    // Update project record
    projects[projectIndex].status = 'deployed';
    projects[projectIndex].deployedAt = new Date().toISOString();
    projects[projectIndex].updatedAt = new Date().toISOString();
    projects[projectIndex].deployUrl = `/sites/${projectId}`;
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
    
    // Clean up upload and build files (optional)
    const cleanupUploads = req.query.cleanup !== 'false';
    if (cleanupUploads) {
      fs.unlink(project.filePath, () => {});
      // Optionally remove build directory
      // fs.rm(extractDir, { recursive: true, force: true }, () => {});
    }
    
    res.json({
      message: 'Deployment successful',
      project: projects[projectIndex],
      buildInfo: buildResult,
      url: projects[projectIndex].deployUrl
    });
    
  } catch (error) {
    // Update project status to failed
    try {
      const projectsPath = path.join(__dirname, '..', 'data', 'projects.json');
      const projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
      const projectIndex = projects.findIndex(p => p.id === req.params.projectId);
      
      if (projectIndex !== -1) {
        projects[projectIndex].status = 'failed';
        projects[projectIndex].error = error.message;
        projects[projectIndex].updatedAt = new Date().toISOString();
        fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
      }
    } catch (updateError) {
      console.error('Failed to update project status:', updateError);
    }
    
    res.status(500).json({ 
      error: 'Deployment failed', 
      details: error.message 
    });
  }
});

module.exports = router;