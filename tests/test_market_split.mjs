import {
  classifySymbolMarket,
  normalizeMarketKey,
  splitRowsByMarket,
  unclassifiedSymbolRows,
} from '../logic.js';

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};
const R = (...syms) => syms.map((s) => ({ symbol: s, shares: 1 }));
const summary = (g) => g.map((x) => `${x.market}:${x.rows.length}`).join(" ");

console.log("1. 代號分類");
for (const [sym, exp] of [["0050","TW"],["2327","TW"],["00631L","TW"],["00988A","TW"],["5274","TW"],
                          ["AMAT","US"],["P","US"],["BE","US"],["TSM","US"],["brk","US"],
                          ["","null"],["-","null"],["合計","null"],["＄100","null"]]) {
  const got = String(classifySymbolMarket(sym));
  check(`${sym || "（空白）"} → ${got}`, got === exp, `預期 ${exp}`);
}

console.log("\n2. 8/12 事故重演：貼美股資料、選台股");
{
  const g = splitRowsByMarket(R("AMAT","AMD","AVGO","BE","CRWD","CSCO","CVX","INTC","LRCX","MU","NVDA","P","PANW","TSM"), "TW");
  check("全部歸 US（舊版會全歸 TW）", summary(g) === "US:14", summary(g));
  check("不產生 TW 群組（＝不會誤判台股全清倉）", !g.some((x) => x.market === "TW"));
}

console.log("\n3. 一表兩市場（手動模式）");
{
  const g = splitRowsByMarket(R("0050","00830","00876","2327","5274","AMAT","NVDA","TSM"), "TW");
  check("拆成兩份", g.length === 2, summary(g));
  check("TW 5 筆 / US 3 筆", summary(g) === "TW:5 US:3", summary(g));
  check("每列都帶對 market", g.every((x) => x.rows.every((r) => classifySymbolMarket(r.symbol) === x.market)));
}

console.log("\n4. 單一市場（正常台股快照）");
{
  const g = splitRowsByMarket(R("0050","0052","00631L","00830","00875"), "TW");
  check("只有 TW 一份", summary(g) === "TW:5", summary(g));
}

console.log("\n5. 無法判定的列 → 多數決安置 + 可被點名");
{
  const rows = R("0050","00830","2327","-","AMAT");
  const g = splitRowsByMarket(rows, "US");
  check("TW 多數 → 併入 TW（不理會 fallback US）", summary(g) === "TW:4 US:1", summary(g));
  const bad = unclassifiedSymbolRows(rows);
  check("點名 1 筆", bad.length === 1 && bad[0].symbol === "-", JSON.stringify(bad));
}
{
  const g = splitRowsByMarket(R("0050","AMAT","合計"), "US");
  check("平手 → 用 fallback（US）", summary(g) === "TW:1 US:2", summary(g));
}
{
  const g = splitRowsByMarket(R("0050","AMAT","合計"), "");
  check("平手且無 fallback → 預設 TW", summary(g) === "TW:2 US:1", summary(g));
}
{
  const g = splitRowsByMarket(R("-","合計"), "");
  check("全部無法判定 → 全進預設 TW", summary(g) === "TW:2", summary(g));
}

console.log("\n6. 邊界");
check("空陣列 → 無群組", splitRowsByMarket([]).length === 0);
check("null → 無群組", splitRowsByMarket(null).length === 0);
{
  const g = splitRowsByMarket(R("00911"), "US");
  check("單支台股、fallback 美股 → 仍歸 TW", summary(g) === "TW:1", summary(g));
}

console.log("\n7. normalizeMarketKey");
check("TW → TW", normalizeMarketKey("TW") === "TW");
check("台股 → TW", normalizeMarketKey("台股") === "TW");
check("us → US", normalizeMarketKey("us") === "US");
check("美股 → US", normalizeMarketKey("美股") === "US");
check("NYSE → US", normalizeMarketKey("NYSE") === "US");
check("空 → 空", normalizeMarketKey("") === "");
check("null → 空", normalizeMarketKey(null) === "");
check("未知 → 原值大寫", normalizeMarketKey("jp") === "JP");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
