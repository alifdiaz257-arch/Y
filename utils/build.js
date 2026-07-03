const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runBuild(projectDir) {
  return new Promise((resolve, reject) => {
    console.log(`Checking build requirements for ${projectDir}...`);
    
    const packageJsonPath = path.join(projectDir, 'package.json');
    const hasPackageJson = fs.existsSync(packageJsonPath);
    
    if (!hasPackageJson) {
      console.log('No package.json found - treating as static site');
      return resolve({
        built: false,
        outputDir: projectDir,
        message: 'Static site - no build required'
      });
    }
    
    // Read package.json to check for build script
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (!packageJson.scripts || !packageJson.scripts.build) {
        console.log('No build script found in package.json');
        return resolve({
          built: false,
          outputDir: projectDir,
          message: 'No build script configured'
        });
      }
      
      // Check if node_modules exists
      const nodeModulesPath = path.join(projectDir, 'node_modules');
      const installCmd = fs.existsSync(nodeModulesPath) 
        ? '' 
        : 'npm install && ';
      
      console.log(`Running build command: ${installCmd}npm run build`);
      
      exec(`${installCmd}npm run build`, { 
        cwd: projectDir,
        timeout: 300000, // 5 minutes timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Build error: ${error.message}`);
          return reject(new Error(`Build failed: ${error.message}`));
        }
        
        // Determine output directory
        const outputDir = fs.existsSync(path.join(projectDir, 'dist'))
          ? path.join(projectDir, 'dist')
          : fs.existsSync(path.join(projectDir, 'build'))
            ? path.join(projectDir, 'build')
            : projectDir;
        
        console.log(`Build completed. Output: ${outputDir}`);
        console.log('Build output:', stdout);
        
        resolve({
          built: true,
          outputDir,
          message: 'Build completed successfully'
        });
      });
      
    } catch (error) {
      reject(new Error(`Failed to read package.json: ${error.message}`));
    }
  });
}

module.exports = { runBuild };