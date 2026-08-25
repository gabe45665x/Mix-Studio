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
const hookSource = path.join(root, '.githooks', 'pre-commit');

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
  const localHooks = path.join(repo, '.githooks');
  fs.mkdirSync(localHooks);
  fs.copyFileSync(hookSource, path.join(localHooks, 'pre-commit'));
  fs.chmodSync(path.join(localHooks, 'pre-commit'), 0o755);
  assert.equal(git(repo, ['config', 'core.hooksPath', '.githooks']).status, 0);

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

    const hookRun = git(repo, ['hook', 'run', 'pre-commit']);
    assert.notEqual(hookRun.status, 0, `git hook run allowed staged secret: ${secret}`);
    assert.match(
      `${hookRun.stdout}\n${hookRun.stderr}`,
      /blocked|secret|sensitive/i,
      `git hook run did not explain why ${secret} was rejected`,
    );

    if (process.platform === 'win32') {
      const gitExecPath = git(repo, ['--exec-path']).stdout.trim();
      const gitRoot = path.resolve(gitExecPath, '..', '..', '..');
      const shPath = path.join(gitRoot, 'bin', 'sh.exe');
      const constrainedPath = [
        path.join(gitRoot, 'cmd'),
        path.join(process.env.SystemRoot || 'C:\\Windows', 'System32'),
      ].join(path.delimiter);
      const constrainedHook = spawnSync(shPath, ['.githooks/pre-commit'], {
        cwd: repo,
        encoding: 'utf8',
        windowsHide: true,
        env: { ...process.env, PATH: constrainedPath },
      });
      assert.notEqual(
        constrainedHook.status,
        0,
        `hook failed open without optional Unix tools: ${secret}`,
      );
      assert.match(
        `${constrainedHook.stdout}\n${constrainedHook.stderr}`,
        /blocked|secret|sensitive/i,
        `constrained hook did not report the staged secret: ${secret}`,
      );

      if (index === 0) {
        const workspaceHook = spawnSync(shPath, ['.githooks/pre-commit'], {
          cwd: root,
          encoding: 'utf8',
          windowsHide: true,
          env: {
            ...process.env,
            GIT_DIR: path.join(repo, '.git'),
            GIT_WORK_TREE: repo,
          },
        });
        assert.notEqual(
          workspaceHook.status,
          0,
          'workspace hook failed open for a staged Hugging Face token',
        );
        assert.match(
          `${workspaceHook.stdout}\n${workspaceHook.stderr}`,
          /blocked|secret|sensitive/i,
          'workspace hook did not report the staged Hugging Face token',
        );
      }
    }

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
