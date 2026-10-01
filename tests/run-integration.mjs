/**
 * Starts the API on a free test port, runs node:test integration tests, then stops the server.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');
const tsxCli = path.join(root, 'node_modules/tsx/dist/cli.mjs');
const PORT = process.env.TEST_PORT ?? '5237';
const base = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await sleep(400);
  }
  throw new Error(`Timed out waiting for ${base}/api/health`);
}

function killTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      child.kill('SIGTERM');
    }
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

const serverEnv = {
  ...process.env,
  PORT,
  NODE_ENV: 'development',
};

const server = spawn(process.execPath, [tsxCli, 'server.ts'], {
  cwd: root,
  env: serverEnv,
  stdio: 'inherit',
  detached: process.platform !== 'win32',
});

let exitCode = 1;
try {
  await waitForHealth();

  const testFiles = ['tests/ai.test.js', 'tests/auth.test.js', 'tests/equipment.test.js'];
  const testRun = spawn(
    process.execPath,
    ['--test', ...testFiles],
    {
      cwd: root,
      env: { ...process.env, TEST_API_BASE: `${base}/api` },
      stdio: 'inherit',
      shell: false,
    }
  );

  exitCode = await new Promise((resolve) => {
    testRun.on('exit', (code) => resolve(code ?? 1));
    testRun.on('error', () => resolve(1));
  });
} catch (e) {
  console.error(e);
  exitCode = 1;
} finally {
  killTree(server);
  await sleep(500);
}

process.exit(exitCode);
