import { toNum } from '../logic.js';

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};

console.log("== toNum ==");
check("數字直傳", toNum(42) === 42);
check("浮點數", toNum(3.14) === 3.14);
check("字串數字", toNum("100") === 100);
check("帶逗號", toNum("1,234") === 1234);
check("帶逗號浮點", toNum("1,234.56") === 1234.56);
check("空字串 → 0", toNum("") === 0);
check("null → 0", toNum(null) === 0);
check("undefined → 0", toNum(undefined) === 0);
check("非數字字串 → 0", toNum("abc") === 0);
check("NaN → 0", toNum(NaN) === 0);
check("Infinity → 0", toNum(Infinity) === 0);
check("-Infinity → 0", toNum(-Infinity) === 0);
check("負數", toNum("-50") === -50);
check("數字 0", toNum(0) === 0);
check("字串 0", toNum("0") === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
