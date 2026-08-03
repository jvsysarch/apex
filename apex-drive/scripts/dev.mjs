import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const trackServerScript = resolve(
  projectRoot,
  'scripts',
  'track-authoring-server.mjs',
);
const viteScript = resolve(
  projectRoot,
  'node_modules',
  'vite',
  'bin',
  'vite.js',
);
const publicDemoConfig = resolve(
  projectRoot,
  '..',
  'apps',
  'apex-demo',
  'vite.config.ts',
);
const children = new Set();
let stopping = false;
const VOID_STARTUP_TIMEOUT_MS = 60_000;

const start = (script, args = []) => {
  const child = spawn(node, [script, ...args], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
};

const stopAll = signal => {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
};

const voidAvailable = async () => {
  try {
    const response = await fetch('http://127.0.0.1:5180/health');
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.service === 'apex-void';
  } catch {
    return false;
  }
};

const waitForVoidServer = async child => {
  const deadline = Date.now() + VOID_STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('APEX Void terminó antes de iniciar Apex Drive');
    }
    if (await voidAvailable()) return;
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw new Error(
    `APEX Void no respondió en ${VOID_STARTUP_TIMEOUT_MS / 1_000} segundos`,
  );
};

process.once('SIGINT', () => stopAll('SIGINT'));
process.once('SIGTERM', () => stopAll('SIGTERM'));

let trackServer;
try {
  if (!(await voidAvailable())) {
    trackServer = start(trackServerScript);
    await waitForVoidServer(trackServer);
  }
  const requestedArguments = process.argv.slice(2);
  const workbench = requestedArguments.includes('--workbench');
  const viteArguments = requestedArguments.filter(
    argument => argument !== '--workbench',
  );
  if (!workbench) {
    viteArguments.push('--config', publicDemoConfig);
  }
  const vite = start(viteScript, viteArguments);
  const exitCode = await new Promise(resolveExit => {
    const finish = code => resolveExit(code ?? 0);
    trackServer?.once('exit', finish);
    vite.once('exit', finish);
  });
  stopAll('SIGTERM');
  process.exitCode = exitCode;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stopAll('SIGTERM');
  process.exitCode = 1;
}
