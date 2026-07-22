#!/usr/bin/env node
// Cross-platform installer wrapper.
// macOS/Linux → setup.sh; Windows → setup.bat

const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const script = isWin ? 'setup.bat' : 'setup.sh';

if (!existsSync(path.join(root, script))) {
  console.error(`Cannot find ${script} in ${root}.`);
  process.exit(1);
}

const result = spawnSync(script, { cwd: root, stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
