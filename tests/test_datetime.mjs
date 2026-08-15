import { taipeiNow, today } from '../logic.js';

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};

console.log("== taipeiNow ==");
{
  const before = Date.now() + 8 * 60 * 60 * 1000;
  const result = taipeiNow();
  const after = Date.now() + 8 * 60 * 60 * 1000;
  check("回傳 Date 物件", result instanceof Date);
  check("時間在合理範圍", result.getTime() >= before - 50 && result.getTime() <= after + 50);
}

console.log("\n== today ==");
{
  const result = today();
  check("格式 YYYY-MM-DD", /^\d{4}-\d{2}-\d{2}$/.test(result), `got "${result}"`);
  const expected = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  check("日期正確（台北）", result === expected, `got "${result}", expected "${expected}"`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
