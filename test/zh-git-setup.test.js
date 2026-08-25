// SPDX-License-Identifier: GPL-3.0-or-later
// Modified from Mix Studio (c) Black Mixture; zh-TW customization (c) gabe45665x 2026
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const scriptPath = path.join(root, 'scripts', 'zh', 'git-setup.ps1');
const powershell = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function git(cwd, args) {
  return run('git', args, cwd);
}

function output(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

test('git setup script creates the fork workflow and is idempotent', {
  skip: process.platform !== 'win32',
}, (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'mix-studio-git-setup-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));

  assert.equal(git(repo, ['init', '-q']).status, 0);
  assert.equal(git(repo, ['config', 'user.name', 'Mix Studio Setup Test']).status, 0);
  assert.equal(git(repo, ['config', 'user.email', 'setup-test@example.invalid']).status, 0);
  fs.writeFileSync(path.join(repo, 'README.md'), '# fixture\n');
  assert.equal(git(repo, ['add', 'README.md']).status, 0);
  assert.equal(git(repo, ['commit', '-q', '-m', 'baseline']).status, 0);
  assert.equal(git(repo, ['tag', 'bec3292']).status, 0);
  assert.equal(
    git(repo, ['remote', 'add', 'origin', 'https://github.com/BlackMixture/Mix-Studio.git']).status,
    0,
  );

  const forkUrl = 'https://github.com/example/Mix-Studio.git';
  const args = [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
    '-RepoPath', repo,
    '-ForkUrl', forkUrl,
  ];

  const first = run(powershell, args, repo);
  assert.equal(first.status, 0, output(first));
  const second = run(powershell, args, repo);
  assert.equal(second.status, 0, output(second));

  assert.equal(git(repo, ['remote', 'get-url', 'origin']).stdout.trim(), forkUrl);
  assert.equal(
    git(repo, ['remote', 'get-url', 'upstream']).stdout.trim(),
    'https://github.com/BlackMixture/Mix-Studio.git',
  );
  assert.equal(git(repo, ['branch', '--show-current']).stdout.trim(), 'zh-tw');
  assert.equal(git(repo, ['config', '--get', 'core.hooksPath']).stdout.trim(), '.githooks');
  assert.equal(
    git(repo, ['rev-parse', 'baseline-bec3292^{commit}']).stdout.trim(),
    git(repo, ['rev-parse', 'HEAD']).stdout.trim(),
  );
});
