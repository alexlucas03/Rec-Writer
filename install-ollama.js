const { execSync } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Ollama installation process...');

const platform = os.platform();

try {
  // Check if Ollama is already installed
  let ollamaInstalled = false;
  
  try {
    execSync('ollama --version', { stdio: 'ignore' });
    ollamaInstalled = true;
    console.log('✅ Ollama is already installed');
  } catch (e) {
    console.log('📦 Ollama not found, proceeding with installation...');
  }

  // Install Ollama if not already installed
  if (!ollamaInstalled) {
    if (platform === 'darwin' || platform === 'linux') {
      // macOS or Linux
      console.log('🔄 Installing Ollama...');
      execSync('curl -fsSL https://ollama.com/install.sh | sh', { stdio: 'inherit' });
      console.log('✅ Ollama installation completed');
    } else if (platform === 'win32') {
      // Windows
      console.log('❗ For Windows, please install Ollama manually from https://ollama.com/download');
      console.log('❗ After installation, you can pull the gemma3 model by running "ollama pull gemma3" in your command prompt');
      process.exit(0);
    } else {
      console.log(`❌ Unsupported platform: ${platform}`);
      process.exit(1);
    }
  }

  // Pull the gemma3 model
  console.log('🔄 Pulling gemma3 model (this may take a while)...');
  execSync('ollama pull gemma3', { stdio: 'inherit' });
  console.log('✅ Successfully pulled gemma3 model');

  console.log('🎉 Setup completed successfully! Your application is ready to use with Ollama and gemma3.');
} catch (error) {
  console.error('❌ An error occurred during setup:');
  console.error(error.message);
  console.log('Please try installing Ollama manually from https://ollama.com/download');
  process.exit(1);
}