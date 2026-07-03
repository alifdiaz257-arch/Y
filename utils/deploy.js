const fs = require('fs-extra');
const path = require('path');

async function deployBuild(sourceDir, targetDir, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`Deploying from ${sourceDir} to ${targetDir}`);
      
      // Validate source directory
      if (!await fs.pathExists(sourceDir)) {
        throw new Error(`Source directory does not exist: ${sourceDir}`);
      }
      
      // Create target directory
      await fs.ensureDir(targetDir);
      
      // Clear target directory if it exists and force option is set
      if (options.force && await fs.pathExists(targetDir)) {
        await fs.emptyDir(targetDir);
      }
      
      // Copy files
      await fs.copy(sourceDir, targetDir, {
        overwrite: true,
        errorOnExist: false,
        filter: (src, dest) => {
          // Exclude unnecessary files
          const exclude = [
            '.git',
            '.gitignore',
            'node_modules',
            '.env',
            'package-lock.json',
            'yarn.lock'
          ];
          
          const basename = path.basename(src);
          return !exclude.includes(basename);
        }
      });
      
      // Create .htaccess for Apache (optional)
      const htaccessPath = path.join(targetDir, '.htaccess');
      if (!await fs.pathExists(htaccessPath)) {
        const htaccess = `# Managed by Simple Hosting\nDirectoryIndex index.html index.htm\n`;
        await fs.writeFile(htaccessPath, htaccess);
      }
      
      // Get deployment info
      const stats = await getDirectoryStats(targetDir);
      
      console.log(`Deployment completed. Files: ${stats.fileCount}, Size: ${formatBytes(stats.totalSize)}`);
      
      resolve({
        success: true,
        targetDir,
        stats
      });
      
    } catch (error) {
      reject(new Error(`Deployment failed: ${error.message}`));
    }
  });
}

// Get directory statistics
async function getDirectoryStats(dirPath) {
  let totalSize = 0;
  let fileCount = 0;
  
  async function walk(dir) {
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        await walk(filePath);
      } else {
        totalSize += stat.size;
        fileCount++;
      }
    }
  }
  
  await walk(dirPath);
  
  return {
    fileCount,
    totalSize
  };
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = { deployBuild };