import { spawnSync } from 'node:child_process';
import process from 'node:process';

function run(command: string, args: string[]) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.NODE_ENV === 'production') {
  console.error('Відмовлено: db:reset:destructive не можна запускати з NODE_ENV=production.');
  process.exit(1);
}

console.warn('УВАГА: буде повністю очищено базу даних, застосовано міграції і створено чисті тестові дані.');
console.warn(`NODE_ENV=${process.env.NODE_ENV ?? 'development'}`);

run('npx', ['prisma', 'migrate', 'reset', '--force', '--skip-seed']);
run('npx', ['prisma', 'generate']);
run('npx', ['tsx', 'prisma/seed.ts']);

console.log('\nГотово: база даних очищена, міграції застосовані, тестові дані створені.');
