import { stripHeaderRow, computeFirstBuyMerge } from '../logic.js';

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

const HEADERS = ["symbol", "first_buy_date", "market"];
const cloud = [
  HEADERS,
  ["0050", "2026-01-05", "TW"],
  ["00830", "2026-02-10", "TW"],
  ["2327", "2026-03-01", "TW"],
  ["AMAT", "2026-03-04", "US"],
  ["NVDA", "2026-07-28", "US"],
];

console.log("== stripHeaderRow ==");
check("含 header → 移除", stripHeaderRow(cloud, HEADERS).length === 5);
check("不含 header → 原樣", stripHeaderRow(cloud.slice(1), HEADERS).length === 5);
check("空陣列 → 空", stripHeaderRow([], HEADERS).length === 0);
check("null → 空", stripHeaderRow(null, HEADERS).length === 0);

console.log("\n== computeFirstBuyMerge ==");

console.log("1. 記憶體殘缺（只剩 1 筆）— 舊版會洗掉，新版須全保留");
{
  const r = computeFirstBuyMerge(cloud, { "TW_0050": "2026-01-05" });
  check("列數 5（未縮表）", r.rows.length === 5, `got ${r.rows.length}`);
  check("00830 仍在", r.rows.some((x) => x[0] === "00830"));
  check("AMAT 仍在", r.rows.some((x) => x[0] === "AMAT"));
  check("不清尾", r.clearFrom === null, `got ${r.clearFrom}`);
}

console.log("2. 記憶體完全為空（換裝置最壞情況）");
{
  const r = computeFirstBuyMerge(cloud, {});
  check("列數 5，雲端零損失", r.rows.length === 5, `got ${r.rows.length}`);
}

console.log("3. 新增一支（正常寫入）");
{
  const r = computeFirstBuyMerge(cloud, { "TW_00876": "2026-08-14" });
  check("列數 6", r.rows.length === 6, `got ${r.rows.length}`);
  check("00876 值正確", r.rows.find((x) => x[0] === "00876")?.[1] === "2026-08-14");
  check("寫入範圍 A2:C7", r.writeRange === "A2:C7", r.writeRange);
}

console.log("4. 記憶體值較新 → 覆蓋雲端舊值");
{
  const r = computeFirstBuyMerge(cloud, { "TW_0050": "2026-08-01" });
  check("0050 取記憶體值", r.rows.find((x) => x[0] === "0050")?.[1] === "2026-08-01");
}

console.log("5. 清倉 removals → 確實移除並清尾");
{
  const r = computeFirstBuyMerge(cloud, { "TW_00830": "2026-02-10" }, ["TW_2327"]);
  check("2327 已移除", !r.rows.some((x) => x[0] === "2327"));
  check("列數 4", r.rows.length === 4, `got ${r.rows.length}`);
  check("清尾範圍 A6:C", r.clearFrom === "A6:C", String(r.clearFrom));
}

console.log("6. 改代號：舊 key 移除、新 key 寫入");
{
  const r = computeFirstBuyMerge(cloud, { "TW_00911": "2026-05-21" }, ["TW_911"]);
  check("00911 存在", r.rows.some((x) => x[0] === "00911"));
  check("911 不存在", !r.rows.some((x) => x[0] === "911"));
}

console.log("7. removals 指到不存在的 key（不應炸）");
{
  const r = computeFirstBuyMerge(cloud, {}, ["TW_XXXX"]);
  check("列數仍 5", r.rows.length === 5, `got ${r.rows.length}`);
}

console.log("8. 空值不覆蓋（記憶體 date 為空字串）");
{
  const r = computeFirstBuyMerge(cloud, { "TW_0050": "" });
  check("0050 保留雲端值", r.rows.find((x) => x[0] === "0050")?.[1] === "2026-01-05");
}

console.log("9. 雲端全空（首次使用）+ 記憶體有值");
{
  const r = computeFirstBuyMerge([HEADERS], { "TW_0050": "2026-01-05", "US_NVDA": "2026-07-28" });
  check("列數 2", r.rows.length === 2, `got ${r.rows.length}`);
  check("不清尾（雲端 0 筆）", r.clearFrom === null, String(r.clearFrom));
}

console.log("10. 排序穩定：先 market 後 symbol");
{
  const r = computeFirstBuyMerge(cloud, {});
  const markets = r.rows.map((x) => x[2]);
  check("TW 在 US 之前", markets.indexOf("US") > markets.lastIndexOf("TW"), markets.join(","));
  const tw = r.rows.filter((x) => x[2] === "TW").map((x) => x[0]);
  check("TW 內部已排序", JSON.stringify(tw) === JSON.stringify([...tw].sort()), tw.join(","));
}

console.log("11. 全數清倉 → rows 為空，仍需清尾（不留舊列）");
{
  const r = computeFirstBuyMerge(cloud, {}, ["TW_0050", "TW_00830", "TW_2327", "US_AMAT", "US_NVDA"]);
  check("rows 空", r.rows.length === 0);
  check("不下 update", r.writeRange === null);
  check("清尾自 A2", r.clearFrom === "A2:C", String(r.clearFrom));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
