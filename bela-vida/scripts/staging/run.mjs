import { spawn } from 'node:child_process';
import { stagingEnvironment, root } from './config.mjs';
try {
  const env = { ...process.env, ...stagingEnvironment(), NEXT_TELEMETRY_DISABLED: '1' };
  const mode = process.argv[2];
  const commands = {
    dev: ['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3100'],
    build: ['node_modules/next/dist/bin/next','build','--webpack'],
    start: ['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],
    smoke: ['--import','./tests/typescript-loader.mjs','scripts/staging/smoke.mjs'],
  };
  if (!commands[mode]) throw new Error('Comando de testes desconhecido.');
  const child = spawn(process.execPath, commands[mode], { cwd: root, env, stdio: 'inherit' });
  for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => child.kill(signal));
  child.on('error', () => { console.error('Não foi possível iniciar o comando de testes.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} catch(error) { console.error(error.message); process.exitCode = 1; }
