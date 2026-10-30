import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const passenger = path.join(root, 'frontend app', 'Rail_bus-main');
const processes = [
  spawn('python', ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', '8008', '--reload'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [path.join(passenger, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { cwd: passenger, stdio: 'inherit' }),
];

let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) if (!child.killed) child.kill('SIGTERM');
  process.exitCode = code;
}

for (const child of processes) {
  child.on('error', (error) => { console.error(error); stopAll(1); });
  child.on('exit', (code) => { if (!stopping && code !== 0) stopAll(code ?? 1); });
}
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
console.log('RailBus API:        http://127.0.0.1:8008/docs');
console.log('Admin & conductor: http://localhost:5173');
console.log('Passenger app:     http://localhost:5173/passenger-app/');
console.log('Direct passenger:  http://localhost:5174/passenger-app/');
