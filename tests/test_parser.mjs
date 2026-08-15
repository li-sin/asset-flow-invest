// 測試 parseLiveTextArk + parseColumnArk 組合解析

const SYMBOL_NAMES = {
  "0050":"元大台灣50","0051":"元大中型100","0052":"富邦科技","0053":"元大電子",
  "00830":"國泰費城半導體","00861":"元大全球未來通訊","00876":"元大全球5G",
  "00893":"國泰智能電動車","00909":"國泰數位支付服務","00910":"第一金太空衛星",
  "00911":"兆豐洲際半導體","00920":"富邦ESG綠色電力","00941":"中信上游半導體",
  "00988A":"主動統一全球創新","2327":"國巨","2330":"台積電",
};
function compactText(v) { return String(v||"").replace(/\s+/g,""); }
function lookupSymbolName(s) { return SYMBOL_NAMES[String(s||"").toUpperCase()]||""; }
function normalizeTWSymbol(symbol) {
  if (!symbol) return symbol;
  const s = String(symbol).toUpperCase().trim();
  if (SYMBOL_NAMES[s]) return s;
  if (SYMBOL_NAMES["00"+s]) return "00"+s;
  return s;
}
function isNoiseLine(line) {
  return /^(《|編輯庫存|台股庫存|美股庫存|持有股票|總共|新增持股|Uber|種類|總股數|成交均價)/.test(compactText(line));
}
function validSnapshotRows(rows) {
  const seen = new Map();
  for (const row of (rows||[]).filter(r=>r?.symbol && r?.shares!=null && r?.avgCost!=null)) {
    const sym = normalizeTWSymbol(row.symbol);
    seen.set(sym, { ...row, symbol: sym, name: row.name||SYMBOL_NAMES[sym]||"" });
  }
  return [...seen.values()];
}

// Parser 1：每股逐行格式（截圖2風格）
function parseLiveTextArk(text) {
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const isCode = s => /^[0-9]{4,6}[A-Za-z]*$/.test(s.replace(/[*＊]/g,"").trim());
  const isKind = s => /^(現股|融資|融券|借券)/.test(s.trim());
  const parseNum = s => {
    const n = parseFloat(s.replace(/,/g,"").replace(/[^\d.]/g,""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const stocks = [], usedIdx = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (usedIdx.has(i)) continue;
    const rawCode = lines[i].replace(/[*＊]/g,"").trim();
    if (!isCode(rawCode)) continue;
    let kindIdx = -1;
    for (let j = i+1; j <= Math.min(i+3, lines.length-1); j++) {
      if (isKind(lines[j])) { kindIdx = j; break; }
    }
    if (kindIdx < 0) continue;
    const nameParts = [];
    for (let j = i-1; j >= Math.max(0,i-4); j--) {
      if (usedIdx.has(j)) break;
      const l = lines[j];
      if (isCode(l.replace(/[*＊]/g,"").trim())) break;
      if (isKind(l)||isNoiseLine(l)) break;
      if (/^\d/.test(l)) break;
      nameParts.unshift(l);
    }
    let shares = null, cost = null;
    for (let j = kindIdx+1; j <= Math.min(kindIdx+6, lines.length-1); j++) {
      if (usedIdx.has(j)) continue;
      const n = parseNum(lines[j]);
      if (n === null) continue;
      if (shares === null) { shares = n; usedIdx.add(j); }
      else if (cost === null) { cost = n; usedIdx.add(j); break; }
    }
    if (shares === null || cost === null) continue;
    usedIdx.add(i); usedIdx.add(kindIdx);
    const symbol = normalizeTWSymbol(rawCode.toUpperCase());
    const name = lookupSymbolName(symbol)||nameParts.join("")||"";
    stocks.push({ symbol, name, kind: lines[kindIdx].trim(), shares, avgCost: cost, source:"live_text" });
  }
  return stocks;
}

// Parser 2：多欄格式（截圖1風格）
// 利用均價行末尾帶「三/二/一/=」標記與股數行無標記的差異來分類
function parseColumnArk(text) {
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const isCode = s => /^[0-9]{4,6}[A-Za-z]*$/.test(s.replace(/[*＊]/g,"").trim());
  const hasCostMarker = l => /[三二一=＝]+\s*$/.test(l.trim());

  // 找第一個「總股數」作為代號區/數字區的分界
  const numStart = lines.findIndex(l => /^總股數/.test(l));
  if (numStart < 0) return [];

  // 代號區（總股數前）
  const codes = [];
  for (let i = 0; i < numStart; i++) {
    const l = lines[i].replace(/[*＊]/g,"").trim();
    if (isCode(l)) codes.push(l);
  }
  if (!codes.length) return [];

  // 數字區（總股數後）：有標記→均價，無標記→股數
  const shares = [], costs = [];
  for (let i = numStart + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^(成交均價|（台幣|新增持股|總共|持有股票)/.test(l)) continue;
    const n = parseFloat(l.replace(/,/g,"").replace(/[^\d.]/g,""));
    if (!Number.isFinite(n) || n <= 0) continue;
    if (hasCostMarker(l)) costs.push(n);
    else shares.push(n);
  }

  const count = Math.min(codes.length, shares.length, costs.length);
  if (!count) return [];
  return codes.slice(0, count).map((code, i) => {
    const sym = normalizeTWSymbol(code.toUpperCase());
    return { symbol: sym, name: lookupSymbolName(sym)||"", kind:"現股", shares: shares[i], avgCost: costs[i], source:"live_text" };
  });
}

// 組合解析器
function parsePasteArk(text) {
  const liveRows = parseLiveTextArk(text);
  const colRows  = parseColumnArk(text);
  // colRows 後放：同代號時 colRows 的精確欄序值覆蓋 liveRows 的可能誤判
  return validSnapshotRows([...liveRows, ...colRows]);
}

// ── 測試資料 ──────────────────────────────────────────────────────────────────
const screenshot1 = `12:03
Uber Eats
<
編輯庫存
台股庫存
美股庫存
=
=
-
1
持有股票
種類
元大中型
100
0051
富邦科技
0052
元大電子
0053
國泰費城
半導體
00830
現股
現股
現股
現股
元大全球未來通訊
00861
現股
元大全球5G
現股
00876
國泰智能電動車
現股
00893
國泰數位支付服務
現股
00909
第一金太空
倍目
相昭
12-28 分鐘
82
總股數
成交均價
（台幣）
132
109.73 =
296
47.11 三
8
230.13 三
733
58.55 三
390
76.45 三
2,177
51.86 三
151
1
44.05 三
40 =
1つつつ
51n1二
總共15檔
新增持股`;

const screenshot2 = `12:05
Uber Eats
10
分鐘
82
台股庫存
編輯庫存
美股庫存

持有股票、；
種類
總股數
成交均價
（台幣）

國泰數位支付服務
00909
現股
1
40 三

第一金太空
衛星
00910
現股
1,223
51.04 三

兆豐洲際
半導體
00911
現股
1,218
35.6 三

富邦ESG綠色電力
00920
現股
420
26.09 三

中信上游
半導體
00941
現股
526
22.99 三

主動統一全球創新
00988A
現股
576
19.14 三

國巨*
2327
現股
349
240.84=

台積電
2330
現股
7
1924.86 三

總共15 檔
新增持股`;

const expected = ["0051","0052","0053","00830","00861","00876","00893","00909","00910","00911","00920","00941","00988A","2327","2330"];
const expectedData = {
  "0051":{s:132,c:109.73},"0052":{s:296,c:47.11},"0053":{s:8,c:230.13},
  "00830":{s:733,c:58.55},"00861":{s:390,c:76.45},"00876":{s:2177,c:51.86},
  "00893":{s:151,c:44.05},"00909":{s:1,c:40},"00910":{s:1223,c:51.04},
  "00911":{s:1218,c:35.6},"00920":{s:420,c:26.09},"00941":{s:526,c:22.99},
  "00988A":{s:576,c:19.14},"2327":{s:349,c:240.84},"2330":{s:7,c:1924.86},
};

console.log("=== 截圖1 單獨 ===");
const r1 = parsePasteArk(screenshot1);
r1.forEach(r => console.log(`  ${r.symbol} ${r.name} 股數=${r.shares} 均價=${r.avgCost}`));

console.log("\n=== 截圖2 單獨 ===");
const r2 = parsePasteArk(screenshot2);
r2.forEach(r => console.log(`  ${r.symbol} ${r.name} 股數=${r.shares} 均價=${r.avgCost}`));

console.log("\n=== 兩張合併貼上 ===");
const combined = parsePasteArk(screenshot1 + "\n" + screenshot2);
console.log(`解析到 ${combined.length} / 15 筆`);
let allOk = true;
for (const sym of expected) {
  const r = combined.find(x=>x.symbol===sym);
  const exp = expectedData[sym];
  const sOk = r?.shares === exp.s;
  const cOk = Math.abs((r?.avgCost||0) - exp.c) < 0.01;
  const ok = r && sOk && cOk;
  if (!ok) allOk = false;
  console.log(`  ${ok?"✅":"❌"} ${sym} ${SYMBOL_NAMES[sym]} 股數=${r?.shares}(預期${exp.s}) 均價=${r?.avgCost}(預期${exp.c})`);
}
console.log(allOk ? "\n全部15筆正確 ✓" : "\n有錯誤，需要修正");
