import { spawn } from 'child_process';

const child = spawn('npx', ['tsx', 'server.ts'], { stdio: ['ignore', 'pipe', 'pipe'] });

child.stdout.on('data', (data) => process.stdout.write(data));
child.stderr.on('data', (data) => process.stderr.write(data));

child.on('close', (code) => {
  console.log('Child closed with code', code);
});

setTimeout(() => {
  console.log('Killing child after 20s');
  child.kill();
  process.exit();
}, 20000);
