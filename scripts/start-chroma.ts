import { spawn } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const CHROMA_SERVER_COMMAND = 'chroma';
const CHROMA_SERVER_ARGS = [
  'run',
  '--path', process.env.CHROMA_PERSISTENCE_PATH || './data/chroma',
  '--host', process.env.CHROMA_SERVER_HOST || 'localhost',
  '--port', process.env.CHROMA_SERVER_PORT || '8000',
];

function startChromaServer() {
  console.log('Starting Chroma server...');
  console.log(`Command: ${CHROMA_SERVER_COMMAND} ${CHROMA_SERVER_ARGS.join(' ')}`);

  const server = spawn(CHROMA_SERVER_COMMAND, CHROMA_SERVER_ARGS, {
    stdio: 'inherit',
  });

  server.on('error', (error) => {
    console.error('Failed to start Chroma server:', error);
    process.exit(1);
  });

  server.on('close', (code) => {
    if (code !== 0) {
      console.error(`Chroma server exited with code ${code}`);
      process.exit(code || 1);
    }
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Shutting down Chroma server...');
    server.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down Chroma server...');
    server.kill('SIGTERM');
  });
}

// Create persistence directory if it doesn't exist
const persistencePath = process.env.CHROMA_PERSISTENCE_PATH || './data/chroma';
if (!path.isAbsolute(persistencePath)) {
  const absolutePath = path.resolve(process.cwd(), persistencePath);
  process.env.CHROMA_PERSISTENCE_PATH = absolutePath;
}

// Start the server
startChromaServer(); 