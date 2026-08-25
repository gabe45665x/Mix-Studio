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
const hookPath = path.join(root, '.githooks');

function git(cwd, args) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
}

test('pre-commit hook accepts ordinary staged text and rejects supported secret patterns', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'mix-studio-hook-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));

  assert.equal(git(repo, ['init', '-q']).status, 0);
  assert.equal(git(repo, ['config', 'user.name', 'Mix Studio Hook Test']).status, 0);
  assert.equal(git(repo, ['config', 'user.email', 'hook-test@example.invalid']).status, 0);
  assert.equal(git(repo, ['config', 'core.hooksPath', hookPath]).status, 0);

  fs.writeFileSync(path.join(repo, 'safe.txt'), 'ordinary configuration\n');
  assert.equal(git(repo, ['add', 'safe.txt']).status, 0);
  const safeCommit = git(repo, ['commit', '-q', '-m', 'safe']);
  assert.equal(safeCommit.status, 0, safeCommit.stderr || safeCommit.stdout);

  const secrets = [
    `h${'f_'}${'x'.repeat(24)}`,
    `pin${'Hash'}=${'a'.repeat(64)}`,
    `auth_${'secret'}=${'b'.repeat(32)}`,
    `ks_${'profile'}=${'c'.repeat(32)}`,
  ];

  for (const [index, secret] of secrets.entries()) {
    const file = `secret-${index}.txt`;
    fs.writeFileSync(path.join(repo, file), `${secret}\n`);
    assert.equal(git(repo, ['add', file]).status, 0);

    const blockedCommit = git(repo, ['commit', '-m', `secret ${index}`]);
    assert.notEqual(blockedCommit.status, 0, `hook allowed staged secret: ${secret}`);
    assert.match(
      `${blockedCommit.stdout}\n${blockedCommit.stderr}`,
      /blocked|secret|sensitive/i,
      `hook did not explain why ${secret} was rejected`,
    );

    assert.equal(git(repo, ['reset', '-q', 'HEAD', '--', file]).status, 0);
    fs.rmSync(path.join(repo, file));
  }
});
