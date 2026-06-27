#!/usr/bin/env node
/**
 * CLI runner for the QA framework.
 * Usage: PROJECT=anil-erp node core/run.js [--plugins api,ui] [--tags smoke]
 */
import { spawn } from 'child_process';

const args = process.argv.slice(2);
const env = { ...process.env };

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--plugins' && args[i + 1]) {
    env.PLUGINS = args[++i];
  } else if (args[i] === '--tags' && args[i + 1]) {
    env.TAGS = args[++i];
  } else if (args[i] === '--browsers' && args[i + 1]) {
    env.BROWSERS = args[++i];
  } else if (args[i] === '--headed') {
    env.HEADED = 'true';
  } else if (args[i] === '--project' && args[i + 1]) {
    env.PROJECT = args[++i];
  }
}

if (!env.PROJECT) {
  console.error('Error: PROJECT env var required. Example: PROJECT=anil-erp node core/run.js');
  process.exit(1);
}

const child = spawn('npx', ['playwright', 'test', ...args.filter((a) => !a.startsWith('--'))], {
  stdio: 'inherit',
  env,
  shell: true,
});

child.on('exit', (code) => process.exit(code ?? 1));
