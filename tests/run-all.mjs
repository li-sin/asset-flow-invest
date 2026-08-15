import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.startsWith('test_') && f.endsWith('.mjs')).sort();

let passed = 0, failed = 0;
const failures = [];

for (const file of files) {
  const path = join(dir, file);
  try {
    const out = execFileSync(process.execPath, ['--experimental-vm-modules', path], {
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const match = out.match(/(\d+) passed, (\d+) failed/);
    if (match) {
      passed += Number(match[1]);
      failed += Number(match[2]);
      if (Number(match[2]) > 0) failures.push(file);
      console.log(`  ✅ ${file}  ${match[1]} passed, ${match[2]} failed`);
    } else {
      const lines = out.trim().split('\n');
      const last = lines[lines.length - 1];
      console.log(`  ✅ ${file}  ${last}`);
    }
  } catch (err) {
    failed++;
    failures.push(file);
    const out = (err.stdout || '') + (err.stderr || '');
    const match = out.match(/(\d+) passed, (\d+) failed/);
    if (match) {
      passed += Number(match[1]);
      failed += Number(match[2]) - 1;
      console.log(`  ❌ ${file}  ${match[1]} passed, ${match[2]} failed`);
    } else {
      console.log(`  ❌ ${file}  crashed`);
      console.log(out.split('\n').slice(0, 5).map((l) => `     ${l}`).join('\n'));
    }
  }
}

console.log(`\n${'='.repeat(40)}`);
console.log(`Total: ${passed} passed, ${failed} failed (${files.length} files)`);
if (failures.length) {
  console.log(`Failed: ${failures.join(', ')}`);
}
process.exit(failed ? 1 : 0);
