import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const REQUIREMENTS = `
setuptools
wheel
numpy>=2.0.0
chromadb>=0.4.23
chromadb[server]
`;

async function installChromaDependencies() {
  // Create requirements.txt
  const requirementsPath = path.join(process.cwd(), 'requirements.txt');
  fs.writeFileSync(requirementsPath, REQUIREMENTS.trim());

  console.log('Installing Chroma Python dependencies...');

  // First upgrade pip
  const pipUpgrade = spawn('python', ['-m', 'pip', 'install', '--upgrade', 'pip'], {
    stdio: 'inherit',
  });

  await new Promise<void>((resolve, reject) => {
    pipUpgrade.on('error', (error) => {
      console.error('Failed to upgrade pip:', error);
      reject(error);
    });

    pipUpgrade.on('close', (code) => {
      if (code !== 0) {
        console.error(`pip upgrade exited with code ${code}`);
        reject(new Error(`pip upgrade failed with code ${code}`));
        return;
      }
      resolve();
    });
  });

  // Install setuptools and wheel first
  const setuptools = spawn('pip', ['install', '--upgrade', 'setuptools', 'wheel'], {
    stdio: 'inherit',
  });

  await new Promise<void>((resolve, reject) => {
    setuptools.on('error', (error) => {
      console.error('Failed to install setuptools:', error);
      reject(error);
    });

    setuptools.on('close', (code) => {
      if (code !== 0) {
        console.error(`setuptools install exited with code ${code}`);
        reject(new Error(`setuptools install failed with code ${code}`));
        return;
      }
      resolve();
    });
  });

  // Install dependencies using pip with --prefer-binary flag
  const pip = spawn('pip', ['install', '-r', 'requirements.txt', '--prefer-binary'], {
    stdio: 'inherit',
  });

  return new Promise<void>((resolve, reject) => {
    pip.on('error', (error) => {
      console.error('Failed to install dependencies:', error);
      reject(error);
    });

    pip.on('close', (code) => {
      if (code !== 0) {
        console.error(`pip install exited with code ${code}`);
        reject(new Error(`pip install failed with code ${code}`));
        return;
      }
      console.log('Successfully installed Chroma dependencies');
      resolve();
    });
  });
}

// Run the installation
installChromaDependencies().catch((error) => {
  console.error('Installation failed:', error);
  process.exit(1);
}); 