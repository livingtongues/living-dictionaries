import { spawn } from 'child_process';

const options = {
  stdio: 'inherit',  // This option will allow the child process to use the parent's stdio
  env: process.env,  // Pass the parent process's environment variables to the child process
  shell: true  // Run the command in a shell
};

// Run the clasp push -w command in a child process
spawn('npx', ['clasp', 'push', '-w'], options);

// Listen for the SIGINT signal
process.on('SIGINT', () => {
  console.info('Caught interrupt signal, running roll-back-variables.js...');

  // Spawn a new process to run the roll-back-variables.js script
  const rollback = spawn('node', ['roll-back-variables.js'], options);

  rollback.on('exit', (code, signal) => {
    console.info('Rollback script exited with ' +
                `code ${code} and signal ${signal}`);
    // End the process
    process.exit();
  });
});
