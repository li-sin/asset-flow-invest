const DB_NAME = "assetflow_invest_screenshots";
const DB_VERSION = 1;
const STORE = "entries";
const APP_VERSION = "v0.26.13";
const APP_VERSION_NOTE = "修正截圖內容手機版表格左右滑動";
const TARGET_LEVEL_STORAGE_KEY = "assetflow_invest_target_levels_v1";
const OCR_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const OCR_WORKER_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js";
const OCR_CORE_URL = "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js";
const OCR_LANG_PATH = "https://tessdata.projectnaptha.com/4.0.0";
const HEIC_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
const GOOGLE_ID_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const GOOGLE_AUTH_SCOPE = "openid email profile";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const DEFAULT_SPREADSHEET_ID = "1adzBH3WaQ_pUgXeSKb2AeGkQE5pXejhHBxQ6MV8XtSI";
const DEFAULT_GOOGLE_CLIENT_ID = "320535010458-m89v1jjn7fkoeu5o9lj3mt5fsn6odp0v.apps.googleusercontent.com";
const DEFAULT_AUTHORIZED_EMAIL = "lovelisa00000@gmail.com";
const QUOTE_PROXY_URL = "https://script.google.com/macros/s/AKfycbznKVxtS6OhxfKO6E1PB21U-X__bSHHdlhUGt8Fj5vv7PRf3Pi_xzsByAHvu0sE8G4/exec";
const LEGACY_GOOGLE_CLIENT_IDS = new Set([
  "320535010458-cccl087b251bejs1coa2oln1n6uddr35.apps.googleusercontent.com",
]);
const SHEET_SYNC_CONFIG_KEY = "assetflow_invest_sheet_sync";
const SHEET_NAMES = {
  snapshots: "AssetFlowSnapshots",
  positions: "AssetFlowPositions",
  levels: "水位",
  layout: "AssetFlowLayout",
  firstBuy: "AssetFlowFirstBuy",
};
const SHEET_HEADERS = {
  snapshots: ["snapshot_id", "created_at", "date", "market", "source_entry_id", "source_title", "row_count", "app_version"],
  positions: ["snapshot_id", "date", "market", "symbol", "name", "kind", "shares", "avg_cost", "source", "created_at"],
  layout: ["date", "market", "symbol", "name", "shares", "prev_shares", "delta"],
  firstBuy: ["symbol", "first_buy_date", "market"],
};
const SYMBOL_NAMES = {
  // ── 台股 ──────────────────────────────────────────────────────────────────
  "0050": "元大台灣50",
  "0051": "元大中型100",
  "0052": "富邦科技",
  "0053": "元大電子",
  "00830": "國泰費城半導體",
  "00861": "元大全球未來通訊",
  "00876": "元大全球5G",
  "00893": "國泰智能電動車",
  "00909": "國泰數位支付服務",
  "00910": "第一金太空衛星",
  "00911": "兆豐洲際半導體",
  "00920": "富邦ESG綠色電力",
  "00941": "中信上游半導體",
  "00988A": "主動統一全球創新",
  "2327": "國巨",
  "2330": "台積電",
  // ── 美股 ──────────────────────────────────────────────────────────────────
  "AMAT": "應用材料",
  "AMD": "超微半導體",
  "AVGO": "博通",
  "BE": "Bloom Energy",
  "BKSY": "BlackSky Technology",
  "CSCO": "思科",
  "FLY": "Firefly Aerospace",
  "GEV": "GE Vernova",
  "INTC": "英特爾",
  "LRCX": "科林研發",
  "MU": "美光科技",
  "NVDA": "輝達",
  "PL": "Planet Labs",
  "SATL": "Satellogic",
  "SNDK": "SanDisk",
  "TSM": "台積電 ADR",
};

const state = {
  entries: [],
  draftImages: [],
  draftEditedRows: null,
  filter: "all",
  query: "",
  cloudSnapshot: null,
  cloudLoading: false,
  cloudHistory: {
    snapshots: [],
    positions: [],
  },
  dashboardTab: "home",
  levelChartRange: "1M",
  levelChartMarket: "TW",
  plTrendRange: "1M",
  scatterRateCap: null,
  scatterAmountCap: null,
  scatterRateDaysCap: null,
  scatterAmountDaysCap: null,
  targetLevels: loadTargetLevels(),
  targetLevelHistory: [],
  firstBuyDates: loadFirstBuyDates(),
  detailSort: { key: "symbol", dir: "asc" },
  batchFirstBuyMode: {},
  detailEditMode: {},
  selectedSnapshotDate: null,
  homeCalendar: { year: new Date().getFullYear(), month: new Date().getMonth(), selectedDate: "" },
  quotes: {},
  auth: {
    signedIn: false,
    authorized: false,
    email: "",
    message: "請使用授權的 Google 帳號登入。",
  },
};

const $ = (selector) => document.querySelector(selector);

const els = {
  appShell: $("#app-shell"),
  authGate: $("#auth-gate"),
  authStatus: $("#auth-status"),
  authEmail: $("#auth-email"),
  authSignIn: $("#auth-sign-in"),
  authSettings: $("#auth-settings"),
  fileInput: $("#file-input"),
  backupInput: $("#backup-input"),
  openCapture: $("#open-capture"),
  capturePanel: $("#capture-panel"),
  closeCapture: $("#close-capture"),
  dropZone: $("#drop-zone"),
  form: $("#entry-form"),
  date: $("#entry-date"),
  market: $("#entry-market"),
  kind: $("#entry-kind"),
  text: $("#entry-text"),
  note: $("#entry-note"),
  parseDraft: $("#parse-draft"),
  parsePreview: $("#parse-preview"),
  ocrStatus: $("#ocr-status"),
  save: $("#save-entry"),
  clear: $("#clear-draft"),
  draftPreview: $("#draft-preview"),
  list: $("#entry-list"),
  empty: $("#empty-state"),
  summary: $("#summary-line"),
  search: $("#search-input"),
  exportBackup: $("#export-backup"),
  syncLatest: $("#sync-latest"),
  saveMergedSnapshot: $("#save-merged-snapshot"),
  cloudSnapshot: $("#cloud-snapshot"),
  appVersion: $("#app-version"),
  detail: $("#detail-panel"),
  detailContent: $("#detail-content"),
  closeDetail: $("#close-detail"),
};

let dbPromise = null;
let swRegistration = null;
let tesseractLoadPromise = null;
let heicLoadPromise = null;
let googleIdentityLoadPromise = null;
let googleTokenClient = null;
let googleAccessToken = "";
let googleAccessTokenExpiresAt = 0;
let sheetTablesReady = false;

function emptyParseResult() {
  return {
    text: "",
    rows: [],
    source: "none",
    parsedAt: null,
  };
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function txStore(mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = callback(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllEntries() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function entryId() {
  return `shot_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function isHeicImage(image) {
  return /image\/hei[cf]/i.test(image?.type || "") || /^data:image\/hei[cf]/i.test(image?.dataUrl || "");
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = String(dataUrl).split(",");
  const mime = header.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const binary = atob(base64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function ensureHeicConverter() {
  if (window.heic2any) return;
  if (!heicLoadPromise) {
    heicLoadPromise = loadScript(HEIC_SCRIPT_URL, () => Boolean(window.heic2any), "HEIC 轉檔模組");
  }
  await heicLoadPromise;
  if (!window.heic2any) {
    throw new Error("HEIC 轉檔模組載入後仍不可用，請重新整理後再試");
  }
}

async function convertHeicToPngDataUrl(source) {
  await ensureHeicConverter();
  const blob = source instanceof Blob ? source : dataUrlToBlob(source.dataUrl);
  const converted = await window.heic2any({
    blob,
    toType: "image/png",
    quality: 0.92,
  });
  const pngBlob = Array.isArray(converted) ? converted[0] : converted;
  return blobToDataUrl(pngBlob);
}

async function imageRecordFromFile(file) {
  const original = {
    name: file.name || "clipboard-image",
    type: file.type,
    size: file.size,
    dataUrl: await fileToDataUrl(file),
  };

  if (!isHeicImage(original)) return original;

  try {
    const dataUrl = await convertHeicToPngDataUrl(file);
    return {
      name: original.name.replace(/\.(hei[cf])$/i, ".png"),
      type: "image/png",
      size: file.size,
      originalName: original.name,
      originalType: original.type,
      convertedFrom: "heic",
      dataUrl,
    };
  } catch (error) {
    console.warn("HEIC conversion failed", error);
    return original;
  }
}

async function addFiles(files) {
  const imageFiles = [...files].filter((file) => file.type.startsWith("image/"));
  if (!imageFiles.length) return;
  const images = await Promise.all(imageFiles.map((file) => imageRecordFromFile(file)));
  state.draftImages.push(...images);
  updateDraftState();
}

function updateDraftState() {
  // 強制 OCR 路徑：save 按鈕只在 OCR 後有 draftEditedRows 才啟用
  els.save.disabled = !(state.draftEditedRows?.length > 0);
  els.parseDraft.disabled = state.draftImages.length === 0;
  els.draftPreview.innerHTML = state.draftImages.map((image) => `
    <div class="draft-shot">
      <img src="${image.dataUrl}" alt="">
      <span>${escapeHtml(image.name)}</span>
    </div>
  `).join("");
  if (!state.draftImages.length) {
    els.ocrStatus.textContent = "尚未解析";
    els.parsePreview.innerHTML = "";
  }
}

function kindLabel(kind) {
  return {
    ark_position: "方舟庫存",
    ark_level: "方舟水位",
    ark_layout: "方舟布局",
    broker_position: "券商庫存",
    other: "其他",
  }[kind] || kind;
}

function statusLabel(status) {
  return {
    new: "未整理",
    reviewed: "已確認",
    imported: "已匯入",
  }[status] || status;
}

function marketLabel(market) {
  return { TW: "台股", US: "美股", ALL: "全部" }[market] || market;
}

function normalizeMarketKey(market) {
  const value = String(market || "").trim().toUpperCase();
  if (["TW", "台股", "TAIWAN", "TPE", "TSE"].includes(value)) return "TW";
  if (["US", "美股", "USA", "NYSE", "NASDAQ"].includes(value)) return "US";
  return value;
}

function marketForPosition(row) {
  const market = normalizeMarketKey(row?.market);
  if (market === "TW" || market === "US") return market;
  return /^\d/.test(String(row?.symbol || "")) ? "TW" : "US";
}

function loadTargetLevels() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TARGET_LEVEL_STORAGE_KEY) || "{}");
    return Object.fromEntries(Object.entries(parsed)
      .map(([market, value]) => [normalizeMarketKey(market), Number(value)])
      .filter(([market, value]) => ["TW", "US"].includes(market) && Number.isFinite(value)));
  } catch (error) {
    console.warn("target levels", error);
    return {};
  }
}

function saveTargetLevels() {
  localStorage.setItem(TARGET_LEVEL_STORAGE_KEY, JSON.stringify(state.targetLevels));
}

const FIRST_BUY_DATES_KEY = "assetflow_invest_first_buy_dates_v1";
function loadFirstBuyDates() {
  try { return JSON.parse(localStorage.getItem(FIRST_BUY_DATES_KEY) || "{}"); } catch { return {}; }
}
async function saveFirstBuyDate(market, symbol, date) {
  state.firstBuyDates[`${market}_${symbol}`] = date;
  localStorage.setItem(FIRST_BUY_DATES_KEY, JSON.stringify(state.firstBuyDates));
  if (state.auth.authorized) {
    await writeFirstBuyDatesToSheet().catch(() => {});
  }
}
// 直接修正 Sheet 裡所有缺 "00" 前綴的台股 ETF 代號
async function fixSheetSymbols() {
  if (!state.auth.authorized) { alert("請先登入"); return; }
  try {
    const values = await readSheetValues(SHEET_NAMES.positions, "A:J");
    const toFix = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const orig = String(row[3] || "").trim();
      const fixed = normalizeTWSymbol(orig);
      if (fixed !== orig) {
        toFix.push({ sheetRow: i + 1, orig, fixed, name: SYMBOL_NAMES[fixed] || row[4] || "" });
      }
    }
    if (!toFix.length) { alert("Sheet 中沒有需要修正的代號。"); return; }
    const preview = toFix.slice(0, 5).map((r) => `${r.orig} → ${r.fixed}`).join("\n");
    if (!confirm(`找到 ${toFix.length} 筆需修正的代號：\n${preview}${toFix.length > 5 ? "\n…" : ""}\n\n確定直接修正 Sheet？`)) return;
    for (const { sheetRow, fixed, name } of toFix) {
      await sheetsFetch(
        `/values/${sheetRange(SHEET_NAMES.positions, `D${sheetRow}:E${sheetRow}`)}?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ majorDimension: "ROWS", values: [[fixed, name]] }) }
      );
    }
    await loadLatestCloudSnapshot(true);
    alert(`已修正 ${toFix.length} 筆代號，資料已重新載入。`);
  } catch (err) {
    console.error(err);
    alert(err.message || "修正失敗");
  }
}

// 清除 Sheet 裡股數=0 且均價=0 的廢棄倉位列
async function cleanupZeroPositions() {
  if (!state.auth.authorized) { alert("請先登入"); return; }
  try {
    const values = await readSheetValues(SHEET_NAMES.positions, "A:J");
    if (values.length <= 1) { alert("沒有資料可清理。"); return; }
    const dataRows = values.slice(1);
    const zeroRows = dataRows.filter((r) => Number(r[6] || 0) === 0 && Number(r[7] || 0) === 0 && r[3]);
    if (!zeroRows.length) { alert("沒有股數=0 且均價=0 的廢棄倉位。"); return; }
    const preview = zeroRows.slice(0, 5).map((r) => `${r[1]} ${r[3]} ${r[4]}`).join("\n");
    if (!confirm(`找到 ${zeroRows.length} 筆廢棄倉位（股數=0、均價=0）：\n${preview}\n\n確定從 Sheet 刪除？`)) return;
    const keepRows = dataRows.filter((r) => !(Number(r[6] || 0) === 0 && Number(r[7] || 0) === 0));
    await clearSheetValues(SHEET_NAMES.positions, `A2:J${values.length}`);
    if (keepRows.length) await updateSheetValues(SHEET_NAMES.positions, `A2:J${keepRows.length + 1}`, keepRows);
    await loadLatestCloudSnapshot(true);
    alert(`已刪除 ${zeroRows.length} 筆廢棄倉位，資料已重新載入。`);
  } catch (err) {
    console.error(err);
    alert(err.message || "清理失敗");
  }
}

async function savePositionEdits(market, symbol, shares, avgCost) {
  if (!state.auth.authorized) { alert("請先登入"); return; }
  // 使用 B tab 當前選擇的日期（selectedSnapshotDate），不寫死最新快照
  const mktSnaps = (state.cloudHistory?.snapshots || [])
    .filter((s) => normalizeMarketKey(s.market) === normalizeMarketKey(market))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const selectedDate = state.selectedSnapshotDate;
  const latestSnap = selectedDate
    ? (mktSnaps.find((s) => s.date === selectedDate) || mktSnaps[0])
    : mktSnaps[0];
  if (!latestSnap) { alert("找不到對應快照"); return; }
  try {
    await ensureCloudSheetTables();
    const values = await readSheetValues(SHEET_NAMES.positions, "A:J");
    const matchingRows = values
      .map((row, i) => ({ row, sheetRow: i + 1 }))
      .filter(({ row }) => row[0] === latestSnap.snapshotId && row[3] === symbol);
    if (!matchingRows.length) { alert(`找不到 ${symbol} 的列`); return; }
    for (const { sheetRow } of matchingRows) {
      await sheetsFetch(
        `/values/${sheetRange(SHEET_NAMES.positions, `G${sheetRow}:H${sheetRow}`)}?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ majorDimension: "ROWS", values: [[shares, avgCost]] }) }
      );
    }
    state.cloudHistory.positions = (state.cloudHistory.positions || []).map((p) =>
      p.snapshotId === latestSnap.snapshotId && p.symbol === symbol
        ? { ...p, shares, avgCost }
        : p
    );
    await recalcLayoutAfterPositionEdit(market, symbol, latestSnap.snapshotId, shares);
    renderCloudSnapshot();
  } catch (err) {
    console.error(err);
    alert(err.message || "儲存失敗");
  }
}

async function recalcLayoutAfterPositionEdit(market, symbol, editedSnapshotId, newShares) {
  const allPositions = state.cloudHistory.positions || [];
  const symbolName = allPositions.find((p) => p.snapshotId === editedSnapshotId && p.symbol === symbol)?.name || "";
  const normalizedMarket = normalizeMarketKey(market);
  const mktSnaps = (state.cloudHistory.snapshots || [])
    .filter((s) => normalizeMarketKey(s.market) === normalizedMarket)
    .sort((a, b) => String(a.date || a.createdAt).localeCompare(String(b.date || b.createdAt)));
  const editedIdx = mktSnaps.findIndex((s) => s.snapshotId === editedSnapshotId);
  if (editedIdx < 0) return;
  const editedSnap = mktSnaps[editedIdx];
  const editedDate = editedSnap.date || editedSnap.createdAt?.slice(0, 10) || "";
  const prevSnap = editedIdx > 0 ? mktSnaps[editedIdx - 1] : null;
  const prevPos = prevSnap ? allPositions.find((p) => p.snapshotId === prevSnap.snapshotId && p.symbol === symbol) : null;
  const prevShares = prevPos ? Number(prevPos.shares ?? 0) : 0;
  const nextSnap = editedIdx + 1 < mktSnaps.length ? mktSnaps[editedIdx + 1] : null;
  const nextDate = nextSnap ? (nextSnap.date || nextSnap.createdAt?.slice(0, 10) || "") : null;
  const nextPos = nextSnap ? allPositions.find((p) => p.snapshotId === nextSnap.snapshotId && p.symbol === symbol) : null;

  const updateMemLayout = (date, shares, pShares) => {
    const newRow = { date, market: normalizedMarket, symbol, name: symbolName, shares, prevShares: pShares, delta: shares - pShares };
    const idx = (state.cloudHistory.layout || []).findIndex(
      (l) => l.date === date && l.symbol === symbol && normalizeMarketKey(l.market) === normalizedMarket
    );
    if (!state.cloudHistory.layout) state.cloudHistory.layout = [];
    if (idx >= 0) state.cloudHistory.layout[idx] = newRow;
    else state.cloudHistory.layout.push(newRow);
  };

  updateMemLayout(editedDate, newShares, prevShares);
  if (nextSnap && nextPos) updateMemLayout(nextDate, Number(nextPos.shares ?? 0), newShares);

  try {
    const values = await readSheetValues(SHEET_NAMES.layout, "A:G");
    const datesToUpdate = new Set([editedDate, ...(nextDate ? [nextDate] : [])]);
    for (const { row, sheetRow } of values.slice(1).map((r, i) => ({ row: r, sheetRow: i + 2 }))) {
      if (row[2] !== symbol || normalizeMarketKey(row[1]) !== normalizedMarket || !datesToUpdate.has(row[0])) continue;
      const memRow = (state.cloudHistory.layout || []).find(
        (l) => l.date === row[0] && l.symbol === symbol && normalizeMarketKey(l.market) === normalizedMarket
      );
      if (!memRow) continue;
      await sheetsFetch(
        `/values/${sheetRange(SHEET_NAMES.layout, `A${sheetRow}:G${sheetRow}`)}?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ majorDimension: "ROWS", values: [[memRow.date, memRow.market, memRow.symbol, memRow.name, memRow.shares, memRow.prevShares, memRow.delta]] }) }
      );
    }
  } catch (err) {
    console.warn("recalcLayoutAfterPositionEdit sheet update failed:", err);
  }
}

async function writeFirstBuyDatesToSheet() {
  await ensureCloudSheetTables();
  await clearSheetValues(SHEET_NAMES.firstBuy, "A2:C");
  const rows = Object.entries(state.firstBuyDates)
    .filter(([, d]) => d)
    .map(([key, d]) => {
      const idx = key.indexOf("_");
      return [key.slice(idx + 1), d, key.slice(0, idx)];
    });
  if (rows.length) await updateSheetValues(SHEET_NAMES.firstBuy, "A2:C", rows);
}
async function loadFirstBuyDatesFromSheet() {
  try {
    const values = await readCloudSheetValues(SHEET_NAMES.firstBuy, "A2:C");
    const rows = stripHeaderRow(values, SHEET_HEADERS.firstBuy);
    const result = {};
    for (const row of rows) {
      const [symbol, date, market] = row;
      if (symbol && date && market) result[`${market}_${symbol}`] = date;
    }
    if (Object.keys(result).length > 0) {
      state.firstBuyDates = result;
      localStorage.setItem(FIRST_BUY_DATES_KEY, JSON.stringify(result));
    } else {
      const local = loadFirstBuyDates();
      if (Object.keys(local).length > 0) {
        state.firstBuyDates = local;
        await writeFirstBuyDatesToSheet().catch(() => {});
      }
    }
  } catch {
    state.firstBuyDates = loadFirstBuyDates();
  }
}
function holdingDays(market, symbol) {
  const dates = state.firstBuyDates;
  const d = dates[`${market}_${symbol}`];
  if (!d) return null;
  const ms = Date.now() - new Date(d).getTime();
  return Math.max(1, Math.floor(ms / 86400000));
}

function targetLevelForMarket(market, snapshotDate = "") {
  const key = normalizeMarketKey(market);
  const value = state.targetLevels[key];
  if (Number.isFinite(value)) return value;
  const sheetValue = targetLevelFromHistory(key, snapshotDate);
  return sheetValue === null ? null : sheetValue;
}

function updateTargetLevel(market, value) {
  const key = normalizeMarketKey(market);
  if (!["TW", "US"].includes(key)) return false;
  const text = String(value ?? "").replace("%", "").trim();
  if (!text) {
    delete state.targetLevels[key];
    saveTargetLevels();
    return true;
  }
  const number = Number(text);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    alert("市場建議水位請輸入 0 到 100 的百分比");
    return false;
  }
  state.targetLevels[key] = number;
  saveTargetLevels();
  return true;
}

async function saveTargetLevelToSheet(market, level) {
  if (!googleAccessToken || !state.auth.authorized) return;
  try {
    const tabName = market === "TW" ? "台股" : "美股";
    const values = await readSheetValues(tabName, "A:B");
    const todayStr = today();
    const levelStr = `${level}%`;
    // only consider rows where A col has a non-empty value
    const dataRows = values.map((row, i) => ({ row, sheetRow: i + 1 })).filter(({ row }) => row[0]);
    const existing = dataRows.find(({ row }) => normalizeDateText(row[0]) === todayStr);
    const writeRange = existing
      ? `B${existing.sheetRow}`
      : `A${(dataRows[dataRows.length - 1]?.sheetRow ?? 0) + 1}:B${(dataRows[dataRows.length - 1]?.sheetRow ?? 0) + 1}`;
    const writeValues = existing ? [[levelStr]] : [[todayStr, levelStr]];
    await sheetsFetch(`/values/${sheetRange(tabName, writeRange)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: JSON.stringify({ majorDimension: "ROWS", values: writeValues }),
    });
    state.targetLevelHistory = [
      { date: todayStr, market, targetLevel: level, source: "水位" },
      ...state.targetLevelHistory.filter((item) => !(item.date === todayStr && item.market === market)),
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  } catch (error) {
    console.warn("saveTargetLevelToSheet", error);
  }
}

function normalizeHeaderText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[：:_-]/g, "");
}

function findHeaderIndex(headers, candidates) {
  const normalized = headers.map(normalizeHeaderText);
  return normalized.findIndex((header) => candidates.some((candidate) => header.includes(normalizeHeaderText(candidate))));
}

function findTargetLevelIndex(headers) {
  const preferred = findHeaderIndex(headers, ["方舟建議水位", "建議水位", "目標水位", "建議%", "targetlevel", "target"]);
  return preferred >= 0 ? preferred : findHeaderIndex(headers, ["水位"]);
}

function normalizeDateText(value) {
  const text = String(value || "").trim();
  const number = Number(text);
  if (/^\d+(\.\d+)?$/.test(text) && Number.isFinite(number) && number >= 30000 && number <= 70000) {
    const date = new Date(Date.UTC(1899, 11, 30 + Math.floor(number)));
    return date.toISOString().slice(0, 10);
  }
  const gvizDate = text.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);
  if (gvizDate) {
    const date = new Date(Date.UTC(Number(gvizDate[1]), Number(gvizDate[2]), Number(gvizDate[3])));
    return date.toISOString().slice(0, 10);
  }
  const matched = text.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (matched) {
    return [
      matched[1],
      matched[2].padStart(2, "0"),
      matched[3].padStart(2, "0"),
    ].join("-");
  }
  const shortMatched = text.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (shortMatched) {
    return [
      today().slice(0, 4),
      shortMatched[1].padStart(2, "0"),
      shortMatched[2].padStart(2, "0"),
    ].join("-");
  }
  return text;
}

function parsePercentValue(value) {
  const text = String(value ?? "").replace("％", "%").trim();
  const number = Number(text.replace("%", "").replace(/,/g, ""));
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

function looksLikePercent(value) {
  const text = String(value ?? "").replace("％", "%").trim();
  return text.includes("%") || (parsePercentValue(text) !== null && !isTwSymbol(text));
}

function marketFromText(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "";
  if (/(^|[^A-Z])TW([^A-Z]|$)|台股|臺股|台灣|臺灣/.test(text)) return "TW";
  if (/(^|[^A-Z])US([^A-Z]|$)|美股|美國/.test(text)) return "US";
  return "";
}

async function loadTargetLevelHistory() {
  try {
    const [twValues, usValues] = await Promise.all([
      readSheetValues("台股", "A:B").catch(() => []),
      readSheetValues("美股", "A:B").catch(() => []),
    ]);
    const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
    const fromTw = twValues
      .filter((row, i) => i > 0 && row[0] && row[1])
      .map((row) => ({ date: normalizeDateText(row[0]), market: "TW", targetLevel: parsePercentValue(row[1]), source: "台股" }))
      .filter((item) => isValidDate(item.date) && item.targetLevel !== null);
    const fromUs = usValues
      .filter((row, i) => i > 0 && row[0] && row[1])
      .map((row) => ({ date: normalizeDateText(row[0]), market: "US", targetLevel: parsePercentValue(row[1]), source: "美股" }))
      .filter((item) => isValidDate(item.date) && item.targetLevel !== null);
    // merge; prefer tab data over levels tab (tab is source of truth)
    const seen = new Map();
    for (const item of [...fromTw, ...fromUs]) {
      const key = `${item.market}_${item.date}`;
      if (!seen.has(key)) seen.set(key, item);
    }
    state.targetLevelHistory = [...seen.values()]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  } catch (error) {
    console.warn("target level history", error);
    state.targetLevelHistory = [];
  }
}

function targetLevelFromHistory(market, snapshotDate = "") {
  const key = normalizeMarketKey(market);
  const normalizedDate = normalizeDateText(snapshotDate);
  const candidates = (state.targetLevelHistory || [])
    .filter((item) => item.market === key)
    .filter((item) => !normalizedDate || !item.date || item.date <= normalizedDate)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return candidates[0]?.targetLevel ?? null;
}

function filteredEntries() {
  const query = state.query.trim().toLowerCase();
  return state.entries
    .filter((entry) => state.filter === "all" || entry.status === state.filter)
    .filter((entry) => {
      if (!query) return true;
      return [entry.title, entry.text, entry.note, entry.market, entry.kind]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => `${b.date} ${b.createdAt}`.localeCompare(`${a.date} ${a.createdAt}`));
}

function render() {
  const entries = filteredEntries();
  if (els.list) els.list.innerHTML = "";
  if (els.empty) els.empty.classList.toggle("is-hidden", entries.length > 0);
  renderSummaryLine();

  for (const entry of entries) {
    const parsedCount = (entry.parsedRows || []).filter((row) => row.symbol).length;
    const card = document.createElement("article");
    card.className = "entry-card";
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="thumb">
        <img src="${entry.images[0]?.dataUrl || ""}" alt="">
      </div>
      <div class="entry-meta">
        <div class="chips">
          <span class="chip">${marketLabel(entry.market)}</span>
          <span class="chip">${kindLabel(entry.kind)}</span>
          <span class="chip ${entry.status}">${statusLabel(entry.status)}</span>
        </div>
        <h3>${escapeHtml(entry.title || "未命名截圖")}</h3>
        <p>${escapeHtml(parsedCount ? `${entry.date} · ${parsedCount} 筆庫存資料` : entry.text || entry.note || entry.date)}</p>
      </div>
    `;
    card.addEventListener("click", () => openDetail(entry.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetail(entry.id);
      }
    });
    if (els.list) els.list.appendChild(card);
  }
}

function renderSummaryLine() {
  if (!els.summary) return;
  const positions = state.cloudSnapshot?.positions || [];
  const date = state.cloudSnapshot?.snapshot?.date;
  if (positions.length) {
    els.summary.textContent = `${date || "最新"} · ${positions.length} 檔庫存 · ${state.entries.length} 張快照`;
    return;
  }
  els.summary.textContent = state.auth.authorized
    ? `尚未讀到雲端庫存 · ${state.entries.length} 張快照`
    : "登入後自動載入雲端庫存";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function saveEntry(event) {
  event.preventDefault();
  if (!state.draftEditedRows?.length) {
    alert("請先按「解析截圖」，確認資料後再存雲端。");
    return;
  }
  await saveDraftDirectToCloud();
}

function clearDraft() {
  state.draftImages = [];
  els.form.reset();
  els.date.value = today();
  els.save.disabled = true;
  els.parseDraft.disabled = true;
  els.draftPreview.innerHTML = "";
  els.parsePreview.innerHTML = "";
  els.ocrStatus.textContent = "尚未解析";
  state.draftEditedRows = null;
}

function buildEntry() {
  const base = {
    id: entryId(),
    date: els.date.value || today(),
    market: els.market.value,
    kind: els.kind.value,
    status: "reviewed",
    title: `${els.market.value || "截圖"} ${els.date.value || today()}`,
    text: els.text.value.trim(),
    note: els.note.value.trim(),
    parsedRows: parseHoldings(els.text.value.trim()),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const images = state.draftImages;
  if (images.length === 1) {
    const image = images[0];
    return {
      ...base,
      images: [image],
      ocrElapsedMs: image.ocrElapsedMs,
      columnOcrMs: image.columnOcrMs,
      rowOcrMs: image.rowOcrMs,
      columnCrops: image.columnCrops || [],
      rowCrops: image.rowCrops || [],
      skippedRowCrops: image.skippedRowCrops || [],
      completeCircleCount: image.completeCircleCount || 0,
      missingRowCount: image.missingRowCount || 0,
    };
  }
  return {
    ...base,
    images,
    columnCrops: images.flatMap((img) => img.columnCrops || []),
    rowCrops: images.flatMap((img) => img.rowCrops || []),
    skippedRowCrops: images.flatMap((img) => img.skippedRowCrops || []),
    completeCircleCount: images.reduce((sum, img) => sum + (img.completeCircleCount || 0), 0),
    missingRowCount: images.reduce((sum, img) => sum + (img.missingRowCount || 0), 0),
  };
}

async function saveDraftDirectToCloud() {
  if (!state.draftEditedRows?.length) { alert("尚無解析資料。"); return; }
  const btn = els.parsePreview.querySelector("#draft-confirm-save");
  if (btn) { btn.disabled = true; btn.textContent = "存入中…"; }
  try {
    const newEntry = buildEntry();
    // 檢查同天同市場是否已有 entry → 若有則詢問合併
    const sameDay = state.entries.find((e) =>
      e.date === newEntry.date &&
      e.market === newEntry.market &&
      e.kind === newEntry.kind &&
      (e.status === "reviewed" || e.status === "imported")
    );
    if (sameDay) {
      const ok = confirm(
        `${newEntry.date} ${marketLabel(newEntry.market)} 已有一筆快照（${(sameDay.parsedRows || []).length} 筆庫存）。\n` +
        `要將新解析的 ${state.draftEditedRows.length} 筆合併進去嗎？（同代號以新資料覆蓋）`
      );
      if (ok) {
        // 合併：舊在前，新在後，dedupeRows 以新覆蓋舊
        sameDay.parsedRows = dedupeRows([...(sameDay.parsedRows || []), ...state.draftEditedRows]);
        sameDay.images = [...(sameDay.images || []), ...(newEntry.images || [])];
        sameDay.updatedAt = new Date().toISOString();
        await txStore("readwrite", (store) => store.put(sameDay));
        const idx = state.entries.findIndex((e) => e.id === sameDay.id);
        if (idx !== -1) state.entries[idx] = sameDay;
        await saveEntrySnapshotToGoogleSheet(sameDay.id);
        clearDraft();
        state.draftEditedRows = null;
        return;
      }
      // 使用者選「否」→ 繼續建立新 entry
    }
    newEntry.parsedRows = state.draftEditedRows;
    newEntry.status = "reviewed";
    await txStore("readwrite", (store) => store.put(newEntry));
    state.entries.unshift(newEntry);
    await saveEntrySnapshotToGoogleSheet(newEntry.id);
    clearDraft();
    state.draftEditedRows = null;
  } catch (err) {
    console.error(err);
    alert(err.message || "存入失敗");
    if (btn) { btn.disabled = false; btn.textContent = "確認並存雲端"; }
  }
}

function openDetail(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  els.detailContent.innerHTML = `
    <div class="detail-body">
      <img class="detail-image" src="${entry.images[0]?.dataUrl || ""}" alt="">
      <div class="chips">
        <span class="chip">${escapeHtml(entry.date)}</span>
        <span class="chip">${marketLabel(entry.market)}</span>
        <span class="chip">${kindLabel(entry.kind)}</span>
        <span class="chip ${entry.status}">${statusLabel(entry.status)}</span>
      </div>
      <h2>${escapeHtml(entry.title || "未命名截圖")}</h2>
      <div class="form-actions detail-actions">
        <button class="button secondary" type="button" data-action="parse-entry">重新解析截圖</button>
        <button class="button secondary" type="button" data-action="export-diagnostics">匯出診斷</button>
        <button class="button secondary" type="button" data-action="mark-reviewed">標記已確認</button>
        ${entry.status === "imported" && entry.images?.some((img) => img.dataUrl)
          ? `<button class="button secondary" type="button" data-action="clear-images">清除截圖（釋放空間）</button>`
          : ""}
        <button class="button primary" type="button" data-action="save-cloud-snapshot">存到 Google Sheet</button>
        <button class="button ghost danger" type="button" data-action="delete">刪除</button>
      </div>
      ${renderOcrCompleteness(entry.expectedTotalCount || entry.completeCircleCount || 0, (entry.parsedRows || []).length || parseHoldings(entry.text || "").length, entry.missingRowCount || 0, "detail", entry.expectedTotalCount ? "total" : "circle")}
      ${renderParsedRows(entry.parsedRows || parseHoldings(entry.text || ""), "detail", id, entry.columnCrops || [], entry.rowCrops || [], entry.skippedRowCrops || [])}
      <div class="detail-grid">
        <div class="detail-field"><span>建立時間</span><strong>${new Date(entry.createdAt).toLocaleString()}</strong></div>
        <div class="detail-field"><span>檔名</span><strong>${escapeHtml(entry.images[0]?.name || "")}</strong></div>
        ${renderOcrTiming(entry)}
      </div>
      <div class="detail-field ocr-text-field">
        <span>擷取文字 / 手動補資料</span>
        <div class="pre-wrap">${escapeHtml(entry.text || "尚未填寫")}</div>
      </div>
      <div class="detail-field">
        <span>備註</span>
        <div class="pre-wrap">${escapeHtml(entry.note || "尚未填寫")}</div>
      </div>
    </div>
  `;
  els.detail.classList.add("is-open");

  els.detailContent.querySelector('[data-action="parse-entry"]').addEventListener("click", () => parseExistingEntry(id));
  els.detailContent.querySelector('[data-action="export-diagnostics"]').addEventListener("click", () => exportEntryDiagnostics(id));
  els.detailContent.querySelector('[data-action="mark-reviewed"]').addEventListener("click", () => updateStatus(id, "reviewed"));
  els.detailContent.querySelector('[data-action="clear-images"]')?.addEventListener("click", () => clearEntryImages(id));
  els.detailContent.querySelector('[data-action="save-cloud-snapshot"]').addEventListener("click", () => saveEntrySnapshotToGoogleSheet(id));
  // detail 頁的「加入草稿」→ 加進 entry.parsedRows（非 draftEditedRows）
  els.detailContent.addEventListener("click", async (e) => {
    if (!e.target.matches("[data-add-skipped]")) return;
    const item = e.target.closest(".skipped-row-item");
    if (!item) return;
    const symbol = (item.querySelector("[data-skipped-symbol]")?.value || "").trim().toUpperCase();
    const name = (item.querySelector("[data-skipped-name]")?.value || "").trim();
    const shares = parseFloat(item.querySelector("[data-skipped-shares]")?.value || "");
    const avgCost = parseFloat(item.querySelector("[data-skipped-avgcost]")?.value || "");
    if (!symbol) { alert("請填入代號"); return; }
    if (!Number.isFinite(shares) || shares <= 0) { alert("請填入有效股數"); return; }
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;
    entry.parsedRows = entry.parsedRows || [];
    entry.parsedRows.push({
      symbol,
      name: name || SYMBOL_NAMES[symbol] || "",
      kind: "現股",
      shares,
      avgCost: Number.isFinite(avgCost) ? avgCost : 0,
      manualSymbol: true,
      manualShares: true,
      manualAvgCost: true,
    });
    entry.updatedAt = new Date().toISOString();
    await txStore("readwrite", (store) => store.put(entry));
    render();
    openDetail(id);
  });
  els.detailContent.querySelector('[data-action="delete"]').addEventListener("click", () => deleteEntry(id));
  els.detailContent.querySelectorAll('[data-action="apply-row-fix"]').forEach((button) => {
    button.addEventListener("click", () => {
      const rowIndex = Number(button.dataset.rowIndex);
      const symbolInput = els.detailContent.querySelector(`[data-symbol-input="${rowIndex}"]`);
      const sharesInput = els.detailContent.querySelector(`[data-shares-input="${rowIndex}"]`);
      const avgCostInput = els.detailContent.querySelector(`[data-avg-cost-input="${rowIndex}"]`);
      applyManualRowFix(id, rowIndex, {
        symbol: symbolInput?.value || "",
        shares: sharesInput?.value || "",
        avgCost: avgCostInput?.value || "",
      });
    });
  });
}

function setOcrStatus(text) {
  els.ocrStatus.textContent = text;
}

function loadScript(src, isReady, label) {
  if (isReady()) return Promise.resolve();
  const existing = document.querySelector(`script[src="${src}"]`);
  return new Promise((resolve, reject) => {
    const script = existing || document.createElement("script");
    const timer = setTimeout(() => reject(new Error(`${label} 載入逾時`)), 20000);
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`無法載入 ${label}，請確認網路連線`));
    };
    if (!existing) {
      script.src = src;
      document.head.appendChild(script);
    }
  });
}

async function ensureTesseract() {
  if (window.Tesseract?.recognize) return;
  if (!tesseractLoadPromise) {
    tesseractLoadPromise = loadScript(OCR_SCRIPT_URL, () => Boolean(window.Tesseract?.recognize), "OCR 模組");
  }
  await tesseractLoadPromise;
  if (!window.Tesseract?.recognize) {
    throw new Error("OCR 模組載入後仍不可用，請重新整理後再試");
  }
}

async function recognizeImage(image, onProgress, options = {}) {
  const startedAt = performance.now();
  const baseImage = await prepareImageForOcr(image, { ...options, maskEditButtons: false });
  const completeMarkers = options.columnOcr ? await detectCompleteCircleMarkers(baseImage.dataUrl) : { count: 0, markers: [] };
  const imageForOcr = options.maskEditButtons
    ? {
      ...baseImage,
      dataUrl: await maskArkEditButtons(baseImage.dataUrl),
      type: "image/png",
      maskedForOcr: true,
    }
    : baseImage;
  await ensureTesseract();

  const attempts = [
    { lang: "chi_tra+eng", label: "繁中/英文" },
    { lang: "eng", label: "英文/數字備援" },
  ];
  const errors = [];

  const full = await recognizeDataUrl(imageForOcr.dataUrl, attempts, (progress, label) => {
    onProgress?.(progress, label);
  }, errors);
  const expectedTotalCount = extractExpectedHoldingCount(full.text);

  if (full.text.trim()) {
    if (!options.columnOcr) {
      return {
        text: full.text,
        mode: full.mode,
        elapsedMs: Math.round(performance.now() - startedAt),
      };
    }

    const rowStartedAt = performance.now();
    const rowLineReview = await detectRowLineReview(imageForOcr.dataUrl, completeMarkers.markers || []);
    if (rowLineReview.needsReview && !options.rowLinePercents?.length) {
      return {
        text: full.text,
        mode: `${full.mode} + 截取線校準`,
        elapsedMs: Math.round(performance.now() - startedAt),
        needsRowLineReview: true,
        rowLineReview: {
          ...rowLineReview,
          fullText: full.text,
          fullMode: full.mode,
        },
        expectedTotalCount,
        completeCircleCount: completeMarkers.count,
        completeCircleMarkers: completeMarkers.markers,
      };
    }

    const calibratedRects = options.rowLinePercents?.length
      ? await rectsFromHorizontalLinePercents(imageForOcr.dataUrl, options.rowLinePercents)
      : rowLineReview.rects;
    const rowResult = await recognizeArkRows(imageForOcr.dataUrl, full.lines || [], completeMarkers.markers || [], calibratedRects, (progress, label) => {
      onProgress?.(progress, label);
    });
    const rowRows = rowResult.rows || [];
    const fullRows = parseHoldings(full.text);
    const rows = rowRows.length ? dedupeRows(rowRows) : [];
    const rowText = renderRowOcrText(rowResult);
    const expectedCount = expectedTotalCount || completeMarkers.count || 0;
    const missingRowCount = expectedCount ? Math.max(0, expectedCount - rows.length) : 0;

    return {
      text: [full.text.trim(), rowText].filter(Boolean).join("\n\n--- 橫列 OCR ---\n\n"),
      mode: `${full.mode} + 橫列裁切`,
      rows,
      elapsedMs: Math.round(performance.now() - startedAt),
      rowOcrMs: Math.round(performance.now() - rowStartedAt),
      rowCrops: rowResult.crops || [],
      columnCrops: rowResult.columnCrops || [],
      skippedRowCrops: rowResult.skipped || [],
      fallbackRows: fullRows,
      expectedTotalCount,
      rowLineReview,
      completeCircleCount: completeMarkers.count,
      completeCircleMarkers: completeMarkers.markers,
      missingRowCount,
    };
  }

  throw new Error(`OCR 無法完成。${errors.join("；")}`);
}

function extractExpectedHoldingCount(text) {
  const normalized = normalizeOcrText(text);
  const compact = normalized.replace(/\s+/g, "");
  const patterns = [
    /總共(\d{1,3})檔/,
    /共(\d{1,3})檔/,
    /(\d{1,3})檔$/,
  ];
  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (!match) continue;
    const count = Number(match[1]);
    if (Number.isInteger(count) && count > 0 && count < 300) return count;
  }
  return 0;
}

async function recognizeDataUrl(dataUrl, attempts, onProgress, errors = []) {
  for (const attempt of attempts) {
    try {
      const result = await window.Tesseract.recognize(dataUrl, attempt.lang, {
        workerPath: OCR_WORKER_URL,
        corePath: OCR_CORE_URL,
        langPath: OCR_LANG_PATH,
        logger: (message) => {
          if (message.status === "recognizing text" && typeof message.progress === "number") {
            onProgress?.(Math.round(message.progress * 100), attempt.label);
          }
        },
      });
      const text = result?.data?.text || "";
      if (text.trim()) return {
        text,
        mode: attempt.label,
        lines: normalizeTesseractLines(result?.data?.lines || []),
      };
      errors.push(`${attempt.label}: 沒有辨識到文字`);
    } catch (error) {
      errors.push(`${attempt.label}: ${error.message || error}`);
    }
  }
  return { text: "", mode: "" };
}

function normalizeTesseractLines(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => {
      const bbox = line?.bbox || {};
      const x0 = Number(bbox.x0 ?? line?.x0);
      const y0 = Number(bbox.y0 ?? line?.y0);
      const x1 = Number(bbox.x1 ?? line?.x1);
      const y1 = Number(bbox.y1 ?? line?.y1);
      if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
      return {
        text: String(line?.text || "").trim(),
        bbox: { x0, y0, x1, y1 },
      };
    })
    .filter((line) => line && line.text && line.bbox.x1 > line.bbox.x0 && line.bbox.y1 > line.bbox.y0);
}

async function recognizeArkRows(dataUrl, fullLines, markers, rects, onProgress) {
  const rowRects = rects?.length ? rects : await detectArkRowRects(dataUrl, fullLines, markers);
  const attempts = [{ lang: "chi_tra+eng", label: "橫列" }];
  const rows = [];
  const crops = [];
  const skipped = [];

  for (let index = 0; index < rowRects.length; index += 1) {
    const rect = rowRects[index];
    const crop = await cropImageDataUrl(dataUrl, rect);
    const label = rect.fallback ? `備援第 ${index + 1} 列` : `第 ${index + 1} 列`;
    const result = await recognizeDataUrl(crop, attempts, (progress) => {
      onProgress?.(progress, `${label} OCR`);
    });
    const parsedRow = parseArkRowCropText(result.text, crop, label);
    const row = rect.fallback ? null : parsedRow;
    const cropRecord = {
      key: `row_${index + 1}`,
      label,
      dataUrl: crop,
      text: result.text || "",
      status: row ? "imported" : "skipped",
      fallback: Boolean(rect.fallback),
    };

    if (row) {
      row.crop = cropRecord;
      rows.push(row);
    } else {
      skipped.push(cropRecord);
    }
    crops.push(cropRecord);
  }

  // ── 豎向欄位裁切：股數欄 + 均價欄，提高數值準確度 ──────────────────────
  // 以 rowRects 數量為基準（不依賴 rows 是否全部解析成功）
  const columnCrops = [];
  if (rowRects.length > 0) {
    const numAttempts = [{ lang: "eng", label: "數值欄" }];
    const colY = Math.max(0, Math.min(...rowRects.map((r) => r.y)) - 0.01);
    const colBottom = Math.min(1, Math.max(...rowRects.map((r) => r.y + r.height)) + 0.01);
    const colH = colBottom - colY;
    const SHARES_RECT   = { x: 0.535, y: colY, width: 0.165, height: colH };
    const AVG_COST_RECT = { x: 0.700, y: colY, width: 0.210, height: colH };

    const [sharesUrl, avgCostUrl] = await Promise.all([
      cropImageDataUrl(dataUrl, SHARES_RECT),
      cropImageDataUrl(dataUrl, AVG_COST_RECT),
    ]);
    const [sharesOcr, avgCostOcr] = await Promise.all([
      recognizeDataUrl(sharesUrl, numAttempts, (p) => onProgress?.(p, "股數欄 OCR")),
      recognizeDataUrl(avgCostUrl, numAttempts, (p) => onProgress?.(p, "均價欄 OCR")),
    ]);

    columnCrops.push(
      { key: "col_shares",  label: "股數欄",  dataUrl: sharesUrl,  text: sharesOcr.text  || "" },
      { key: "col_avgCost", label: "均價欄", dataUrl: avgCostUrl, text: avgCostOcr.text || "" },
    );

    const sharesVals  = extractColumnNumbersFlex(sharesOcr.text  || "");
    const avgCostVals = extractColumnNumbersFlex(avgCostOcr.text || "");
    const expectCount = rowRects.length;

    // 以 rowRects 索引對齊：rows 中的每一筆找到對應的欄位值來覆蓋
    // rows 的第 n 筆對應 crops 中非 skipped 的第 n 個 rect → 用 crops 順序推
    if (sharesVals.length === expectCount || avgCostVals.length === expectCount) {
      let rowIdx = 0;
      for (let ri = 0; ri < crops.length && rowIdx < rows.length; ri++) {
        if (crops[ri].status !== "imported") continue;
        const row = rows[rowIdx];
        // shares：欄位 OCR 較精準（小數股數），有值就覆蓋
        if (sharesVals.length === expectCount && sharesVals[ri] != null) row.shares = sharesVals[ri];
        // avgCost：row crop 已含完整上下文，欄位 OCR 易因右對齊裁切而漏前幾位（119.6→9）
        // 策略：row crop 有合理值就保留；只有 row crop 失敗（≤0 或 null）才用欄位 OCR 補
        if (avgCostVals.length === expectCount && avgCostVals[ri] != null && !(row.avgCost > 0)) {
          row.avgCost = avgCostVals[ri];
        }
        rowIdx++;
      }
    }
  }

  return { rows, crops, skipped, columnCrops };
}

async function detectRowLineReview(dataUrl, markers) {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const markerCenters = (markers || [])
    .map((marker) => Number(marker.centerY))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (markerCenters.length < 2) return { needsReview: false, rects: [] };

  const separators = await detectArkRowSeparators(image);
  const first = markerCenters[0];
  const last = markerCenters[markerCenters.length - 1];
  const innerLines = separators.filter((line) => line > first && line < last);
  const expectedLines = markerCenters.length - 1;
  const linePercents = normalizeRowLinePercents(
    innerLines.length ? innerLines.map((line) => (line / height) * 100) : defaultRowLinePercents(markerCenters, height),
    expectedLines,
    markerCenters,
    height
  );
  const rects = rectsFromHorizontalLines(linePercents.map((value) => (value / 100) * height), width, height);
  return {
    needsReview: innerLines.length !== expectedLines,
    expectedLines,
    detectedLines: innerLines.length,
    linePercents,
    imageDataUrl: dataUrl,
    rects,
  };
}

function normalizeRowLinePercents(linePercents, expectedLines, markerCenters, height) {
  const fallback = defaultRowLinePercents(markerCenters, height);
  const values = [...(linePercents || [])]
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .slice(0, expectedLines);
  while (values.length < expectedLines) values.push(fallback[values.length] ?? 50);
  return values.map((value, index) => {
    const min = index > 0 ? values[index - 1] + 1.2 : 18;
    const max = index < expectedLines - 1 ? values[index + 1] - 1.2 : 86;
    return Math.max(min, Math.min(max, value));
  });
}

function defaultRowLinePercents(markerCenters, height) {
  return markerCenters.slice(0, -1).map((center, index) => ((center + markerCenters[index + 1]) / 2 / height) * 100);
}

async function rectsFromHorizontalLinePercents(dataUrl, linePercents) {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  return rectsFromHorizontalLines(linePercents.map((value) => (Number(value) / 100) * height), width, height);
}

function rectsFromHorizontalLines(lines, width, height) {
  const sorted = [...(lines || [])].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return [];
  const gaps = sorted.slice(1).map((line, index) => line - sorted[index]).filter((gap) => gap > height * 0.035);
  const rowHeight = gaps.length ? Math.max(height * 0.052, Math.min(height * 0.12, gaps[Math.floor(gaps.length / 2)] * 0.86)) : height * 0.074;
  const boundaries = [
    Math.max(height * 0.19, sorted[0] - rowHeight),
    ...sorted,
    Math.min(height * 0.84, sorted[sorted.length - 1] + rowHeight),
  ];
  return boundaries.slice(0, -1).map((top, index) => {
    const bottom = boundaries[index + 1];
    return {
      x: 0.095,
      y: top / height,
      width: 0.87,
      height: Math.max(1, bottom - top) / height,
      top,
      bottom,
      lineBased: true,
    };
  }).filter((rect) => rect.height > 0.03);
}

async function detectArkRowRects(dataUrl, fullLines = [], markers = []) {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const left = 0.095;
  const right = 0.965;
  const markerRects = rectsFromCircleMarkers(markers, width, height, left, right);
  if (markerRects.length) return markerRects;

  const separators = await detectArkRowSeparators(image);
  const minHeight = height * 0.052;
  const maxHeight = height * 0.145;
  const rects = rectsFromSeparators(separators, width, height, left, right, minHeight, maxHeight);

  return rects.length ? rects : fallbackArkRowRects(width, height, left, right);
}

function rectsFromCircleMarkers(markers, width, height, left, right) {
  const centers = (markers || [])
    .map((marker) => Number(marker.centerY))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!centers.length) return [];

  const gaps = centers
    .slice(1)
    .map((center, index) => center - centers[index])
    .filter((gap) => gap > height * 0.035 && gap < height * 0.12)
    .sort((a, b) => a - b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : height * 0.074;
  const rowHeight = Math.max(height * 0.052, Math.min(height * 0.115, medianGap * 0.88));
  const topLimit = height * 0.19;
  const bottomLimit = height * 0.84;

  return centers.map((center, index) => {
    const top = Math.max(topLimit, center - rowHeight * 0.48);
    const bottom = Math.min(bottomLimit, center + rowHeight * 0.58);
    const visibleHeight = bottom - top;
    return {
      x: left,
      y: top / height,
      width: right - left,
      height: visibleHeight / height,
      top,
      bottom,
      markerBased: true,
      fallback: visibleHeight < rowHeight * 0.72,
      markerIndex: index + 1,
    };
  }).filter((rect) => rect.height > 0.03);
}

function rectsFromSeparators(separators, width, height, left, right, minHeight, maxHeight) {
  return separators.slice(0, -1).map((top, index) => {
    const bottom = separators[index + 1];
    const rowHeight = bottom - top;
    if (rowHeight < minHeight || rowHeight > maxHeight) return null;
    return {
      x: left,
      y: (top + 1) / height,
      width: right - left,
      height: Math.max(1, rowHeight - 2) / height,
      top,
      bottom,
    };
  }).filter(Boolean);
}

function fallbackArkRowRects(width, height, left, right) {
  const top = height * 0.21;
  const bottom = height * 0.82;
  const rowHeight = height * 0.086;
  const gap = height * 0.006;
  const rects = [];

  for (let y = top; y + rowHeight <= bottom; y += rowHeight + gap) {
    rects.push({
      x: left,
      y: y / height,
      width: right - left,
      height: rowHeight / height,
      fallback: true,
    });
  }

  return rects;
}

async function detectArkRowSeparators(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height).data;
  const xStart = Math.round(width * 0.095);
  const xEnd = Math.round(width * 0.97);
  const yStart = Math.round(height * 0.2);
  const yEnd = Math.round(height * 0.84);
  const candidates = [];

  for (let y = yStart; y < yEnd; y += 1) {
    let matching = 0;
    let total = 0;
    for (let x = xStart; x < xEnd; x += 4) {
      const index = (y * width + x) * 4;
      const red = imageData[index];
      const green = imageData[index + 1];
      const blue = imageData[index + 2];
      const brightness = (red + green + blue) / 3;
      const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (brightness >= 39 && brightness <= 66 && spread <= 16) matching += 1;
      total += 1;
    }
    if (total && matching / total > 0.55) candidates.push(y);
  }

  const groups = [];
  let current = [];
  for (const y of candidates) {
    if (!current.length || y <= current[current.length - 1] + 2) {
      current.push(y);
      continue;
    }
    groups.push(current);
    current = [y];
  }
  if (current.length) groups.push(current);

  const minGap = height * 0.045;
  const separators = groups
    .map((group) => group[group.length - 1])
    .filter((y, index, items) => index === 0 || y - items[index - 1] >= minGap);

  return separators;
}

async function detectCompleteCircleMarkers(dataUrl) {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height).data;
  const xStart = Math.round(width * 0.012);
  const xEnd = Math.round(width * 0.092);
  const yStart = Math.round(height * 0.18);
  const yEnd = Math.round(height * 0.88);
  const rowScores = [];

  for (let y = yStart; y < yEnd; y += 1) {
    let active = 0;
    for (let x = xStart; x < xEnd; x += 1) {
      const index = (y * width + x) * 4;
      const red = imageData[index];
      const green = imageData[index + 1];
      const blue = imageData[index + 2];
      const brightness = (red + green + blue) / 3;
      const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      const isColorMarker = spread > 22 && brightness > 35 && brightness < 245;
      const isDarkMarker = spread <= 22 && brightness > 30 && brightness < 185;
      const isGrayMarker = spread <= 18 && brightness >= 185 && brightness < 224;
      const isMarker = isColorMarker || isDarkMarker || isGrayMarker;
      if (isMarker) active += 1;
    }
    rowScores.push({ y, active });
  }

  const threshold = Math.max(4, Math.round((xEnd - xStart) * 0.09));
  const bands = [];
  let current = [];
  for (const score of rowScores) {
    if (score.active >= threshold) {
      current.push(score);
      continue;
    }
    if (current.length) {
      bands.push(current);
      current = [];
    }
  }
  if (current.length) bands.push(current);

  const minHeight = height * 0.016;
  const maxHeight = height * 0.08;
  const markers = bands.map((band) => {
    const top = band[0].y;
    const bottom = band[band.length - 1].y;
    const maxActive = Math.max(...band.map((item) => item.active));
    return {
      top,
      bottom,
      centerY: Math.round((top + bottom) / 2),
      height: bottom - top + 1,
      maxActive,
    };
  }).filter((marker) => marker.height >= minHeight && marker.height <= maxHeight);

  const deduped = [];
  const minGap = height * 0.035;
  for (const marker of markers) {
    const previous = deduped[deduped.length - 1];
    if (previous && marker.centerY - previous.centerY < minGap) {
      if (marker.maxActive > previous.maxActive) deduped[deduped.length - 1] = marker;
      continue;
    }
    deduped.push(marker);
  }

  return { count: deduped.length, markers: deduped };
}

function extractNumbersAfterHolding(text) {
  const normalized = normalizeOcrText(text);
  const index = normalized.search(/現\s*股/);
  if (index < 0) return [];
  return (normalized.slice(index).match(/[\d,]+(?:\.\d+)?/g) || [])
    .map(parseNumberToken)
    .filter((value) => value !== null);
}

async function prepareImageForOcr(image, options = {}) {
  const converted = isHeicImage(image)
    ? {
      ...image,
      dataUrl: await convertHeicToPngDataUrl(image),
      type: "image/png",
      convertedFrom: image.convertedFrom || "heic",
    }
    : image;

  if (!options.maskEditButtons) return converted;

  return {
    ...converted,
    dataUrl: await maskArkEditButtons(converted.dataUrl),
    type: "image/png",
    maskedForOcr: true,
  };
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片載入失敗，無法進行 OCR 前處理"));
    image.src = dataUrl;
  });
}

async function maskArkEditButtons(dataUrl) {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);

  const maskWidth = Math.round(canvas.width * 0.095);
  const top = Math.round(canvas.height * 0.2);
  const bottom = Math.round(canvas.height * 0.85);
  ctx.fillStyle = "#151515";
  ctx.fillRect(0, top, maskWidth, bottom - top);

  return canvas.toDataURL("image/png", 0.95);
}

async function cropImageDataUrl(dataUrl, rect) {
  const image = await loadImage(dataUrl);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sx = Math.round(sourceWidth * rect.x);
  const sy = Math.round(sourceHeight * rect.y);
  const sw = Math.round(sourceWidth * rect.width);
  const sh = Math.round(sourceHeight * rect.height);

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/png", 0.95);
}

async function imageDimensions(dataUrl) {
  const image = await loadImage(dataUrl);
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
  };
}

async function recognizeArkColumns(dataUrl, onProgress) {
  const columnAttempts = [{ lang: "chi_tra+eng", label: "欄位" }];
  const columns = [
    { key: "name", label: "持有股票欄", rect: { x: 0.095, y: 0.215, width: 0.255, height: 0.64 } },
    { key: "shares", label: "總股數欄", rect: { x: 0.535, y: 0.215, width: 0.165, height: 0.64 } },
    { key: "avgCost", label: "成交均價欄", rect: { x: 0.72, y: 0.215, width: 0.18, height: 0.64 } },
  ];
  const result = {};

  for (const column of columns) {
    const crop = await cropImageDataUrl(dataUrl, column.rect);
    const text = await recognizeDataUrl(crop, columnAttempts, (progress) => {
      onProgress?.(progress, column.label);
    });
    result[column.key] = text.text || "";
    result.crops = result.crops || [];
    result.crops.push({
      key: column.key,
      label: column.label,
      dataUrl: crop,
    });
  }

  return result;
}

function renderColumnOcrText(column) {
  if (!column) return "";
  return [
    "【持有股票欄】",
    column.name || "",
    "【總股數欄】",
    column.shares || "",
    "【成交均價欄】",
    column.avgCost || "",
  ].join("\n").trim();
}

async function applyManualRowFix(entryId, rowIndex, values) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry?.parsedRows?.[rowIndex]) return;

  const symbol = normalizeSymbolInput(values.symbol);
  if (!isTwSymbol(symbol) && !isUsSymbol(symbol)) {
    alert("請輸入有效代號，例如 0050、2330、NVDA、TSM");
    return;
  }

  const shares = parseManualNumber(values.shares);
  const avgCost = parseManualNumber(values.avgCost);
  if (shares === null || avgCost === null) {
    alert("請輸入有效股數與成交均價");
    return;
  }

  const row = entry.parsedRows[rowIndex];
  const officialName = lookupSymbolName(symbol);
  entry.parsedRows[rowIndex] = {
    ...row,
    symbol,
    name: officialName || row.ocrName || row.name || "",
    shares,
    avgCost,
    needsReview: !officialName,
    reviewReason: officialName ? "" : "名稱待補",
    manualSymbol: true,
    manualShares: true,
    manualAvgCost: true,
  };
  entry.updatedAt = new Date().toISOString();
  await txStore("readwrite", (store) => store.put(entry));
  render();
  openDetail(entryId);
}

function parseManualNumber(value) {
  const text = String(value || "").replace(/,/g, "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function normalizeSymbolInput(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^\dA-Za-z]/g, "")
    .toUpperCase();
}

function bindDraftPreviewAfterRender(parsedRows) {
  // 初始化 draftEditedRows（深拷貝目前 parsedRows）
  state.draftEditedRows = parsedRows.map((r) => ({ ...r }));
  // OCR 完成後依 draftEditedRows 更新 save 按鈕狀態
  if (els.save) els.save.disabled = !(state.draftEditedRows.length > 0);
  // 綁定 live edit 事件
  els.parsePreview.querySelectorAll("[data-draft-symbol]").forEach((input) => {
    input.addEventListener("input", () => {
      const i = Number(input.dataset.draftSymbol);
      if (state.draftEditedRows?.[i]) {
        state.draftEditedRows[i].symbol = input.value.trim().toUpperCase();
        state.draftEditedRows[i].name = SYMBOL_NAMES[state.draftEditedRows[i].symbol] || state.draftEditedRows[i].name;
      }
    });
  });
  els.parsePreview.querySelectorAll("[data-draft-shares]").forEach((input) => {
    input.addEventListener("input", () => {
      const i = Number(input.dataset.draftShares);
      if (state.draftEditedRows?.[i]) state.draftEditedRows[i].shares = Number(input.value) || 0;
    });
  });
  els.parsePreview.querySelectorAll("[data-draft-avgcost]").forEach((input) => {
    input.addEventListener("input", () => {
      const i = Number(input.dataset.draftAvgcost);
      if (state.draftEditedRows?.[i]) state.draftEditedRows[i].avgCost = Number(input.value) || 0;
    });
  });
  els.parsePreview.querySelectorAll("[data-draft-name]").forEach((input) => {
    input.addEventListener("input", () => {
      const i = Number(input.dataset.draftName);
      if (state.draftEditedRows?.[i]) state.draftEditedRows[i].name = input.value.trim();
    });
  });
  els.parsePreview.querySelectorAll("[data-draft-kind]").forEach((input) => {
    input.addEventListener("input", () => {
      const i = Number(input.dataset.draftKind);
      if (state.draftEditedRows?.[i]) state.draftEditedRows[i].kind = input.value.trim();
    });
  });
  // 若有 parsedRows，顯示確認存雲端按鈕
  if (parsedRows.length > 0) {
    const confirmDiv = document.createElement("div");
    confirmDiv.className = "draft-confirm-actions";
    confirmDiv.innerHTML = `<button class="button primary" type="button" id="draft-confirm-save">確認並存雲端</button>`;
    els.parsePreview.appendChild(confirmDiv);
    confirmDiv.querySelector("#draft-confirm-save").addEventListener("click", saveDraftDirectToCloud);
  }
  // 比對現有庫存 vs OCR 結果，缺少代號顯示確認列
  const latestSnap = (state.cloudHistory?.snapshots || [])
    .filter((s) => normalizeMarketKey(s.market) === normalizeMarketKey(els.market.value))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  if (latestSnap) {
    const existingSymbols = (state.cloudHistory?.positions || [])
      .filter((p) => p.snapshotId === latestSnap.snapshotId)
      .map((p) => p.symbol);
    const parsedSymbols = new Set((state.draftEditedRows || []).map((r) => r.symbol).filter(Boolean));
    const missingFromOcr = existingSymbols.filter((s) => !parsedSymbols.has(s));
    if (missingFromOcr.length > 0) {
      const missingDiv = document.createElement("div");
      missingDiv.className = "ocr-missing-confirm";
      missingDiv.innerHTML = `
        <p class="ocr-completeness warning"><strong>⚠ 庫存中有但 OCR 未解析到（${missingFromOcr.length} 支）</strong></p>
        ${missingFromOcr.map((sym) => {
          const name = SYMBOL_NAMES[sym] || sym;
          return `<div class="missing-symbol-row" data-missing-symbol="${escapeHtml(sym)}">
            <span class="missing-symbol-label">${escapeHtml(sym)} ${escapeHtml(name)}</span>
            <label>股數<input type="number" step="0.001" class="missing-shares" placeholder="股數"></label>
            <label>均價<input type="number" step="0.001" class="missing-avgcost" placeholder="均價"></label>
            <button class="button secondary compact missing-add-btn" type="button">加入</button>
            <button class="button ghost compact missing-skip-btn" type="button">略過</button>
          </div>`;
        }).join("")}
      `;
      els.parsePreview.appendChild(missingDiv);
      missingDiv.querySelectorAll(".missing-add-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const row = btn.closest("[data-missing-symbol]");
          const sym = row.dataset.missingSymbol;
          const shares = Number(row.querySelector(".missing-shares").value) || 0;
          const avgCost = Number(row.querySelector(".missing-avgcost").value) || 0;
          state.draftEditedRows.push({
            symbol: sym,
            name: SYMBOL_NAMES[sym] || sym,
            kind: "現股",
            shares,
            avgCost,
            needsReview: false,
          });
          row.remove();
          if (!missingDiv.querySelector("[data-missing-symbol]")) missingDiv.remove();
        });
      });
      missingDiv.querySelectorAll(".missing-skip-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          btn.closest("[data-missing-symbol]").remove();
          if (!missingDiv.querySelector("[data-missing-symbol]")) missingDiv.remove();
        });
      });
    }
  }
}

async function parseDraftImages() {
  if (!state.draftImages.length || els.parseDraft.disabled) return;
  els.parseDraft.disabled = true;
  setOcrStatus("載入 OCR 中...");
  try {
    const texts = [];
    for (let index = 0; index < state.draftImages.length; index += 1) {
      const image = state.draftImages[index];
      setOcrStatus(`解析第 ${index + 1}/${state.draftImages.length} 張`);
      const result = await Promise.race([
        recognizeImage(image, (progress, mode) => {
          setOcrStatus(`解析第 ${index + 1}/${state.draftImages.length} 張 ${progress}%（${mode}）`);
        }, {
          maskEditButtons: els.kind.value === "ark_position",
          columnOcr: els.kind.value === "ark_position",
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("OCR 逾時（超過 90 秒），請重新整理後再試")), 90000)),
      ]);
      if (result.needsRowLineReview) {
        image.pendingRowLineReview = result.rowLineReview;
        image.rowLineReview = result.rowLineReview;
        image.expectedTotalCount = result.expectedTotalCount || 0;
        image.completeCircleCount = result.completeCircleCount || 0;
        texts.push(result.text.trim());
        if (state.draftImages.length === 1) {
          els.text.value = result.text.trim();
          els.parsePreview.innerHTML = renderRowLineReview(result.rowLineReview, index);
          bindRowLineReviewControls(index);
          renderRowLineApplyAction();
          setOcrStatus(`需要調整截取線：紅圈 ${image.completeCircleCount} 個，偵測到 ${result.rowLineReview.detectedLines} 條線，應為 ${result.rowLineReview.expectedLines} 條`);
          return;
        }
        continue;
      }
      texts.push(result.text.trim());
      if (Array.isArray(result.rows)) {
        image.parsedRows = result.rows;
        image.ocrElapsedMs = result.elapsedMs;
        image.columnOcrMs = result.columnOcrMs;
        image.rowOcrMs = result.rowOcrMs;
        image.columnCrops = result.columnCrops || [];
        image.rowCrops = result.rowCrops || [];
        image.skippedRowCrops = result.skippedRowCrops || [];
        image.expectedTotalCount = result.expectedTotalCount || 0;
        image.rowLineReview = result.rowLineReview || null;
        image.completeCircleCount = result.completeCircleCount || 0;
        image.missingRowCount = result.missingRowCount || 0;
      }
    }
    const combinedText = texts.filter(Boolean).join("\n\n---\n\n");
    els.text.value = combinedText;
    const rows = state.draftImages.flatMap((image) => image.parsedRows || []);
    const parsedRows = rows.length ? dedupeRows(rows) : parseHoldings(els.text.value);
    const columnCrops = state.draftImages.flatMap((image) => image.columnCrops || []);
    const rowCrops = state.draftImages.flatMap((image) => image.rowCrops || []);
    const skippedRowCrops = state.draftImages.flatMap((image) => image.skippedRowCrops || []);
    const expectedTotal = Math.max(...state.draftImages.map((image) => image.expectedTotalCount || 0), 0);
    const expectedRows = expectedTotal || state.draftImages.reduce((sum, image) => sum + (image.completeCircleCount || 0), 0);
    const missingRows = expectedRows ? Math.max(0, expectedRows - parsedRows.length) : 0;
    const needsCalibration = missingRows > 0 && state.draftImages.some((image) => image.rowLineReview?.imageDataUrl);
    const calibrationBlocks = needsCalibration
      ? state.draftImages
        .map((image, imageIndex) => image.rowLineReview?.imageDataUrl ? renderRowLineReview({
          ...image.rowLineReview,
          reason: `總檔數顯示 ${expectedRows} 檔，目前合併解析 ${parsedRows.length} 筆，可能少 ${missingRows} 筆。`,
          extraLineCount: Math.max(0, missingRows - 1),
        }, imageIndex) : "")
        .join("")
      : "";
    if (needsCalibration) {
      // 任務 1：少檔數時先只顯示截取線調整，不顯示解析表格和確認按鈕
      els.parsePreview.innerHTML = [
        renderOcrCompleteness(expectedRows, parsedRows.length, missingRows, "draft", expectedTotal ? "total" : "circle"),
        calibrationBlocks,
      ].filter(Boolean).join("");
      state.draftImages.forEach((_, imageIndex) => bindRowLineReviewControls(imageIndex));
      renderRowLineApplyAction();
      state.draftEditedRows = null; // 強制等截取線調整後才設定
    } else {
      els.parsePreview.innerHTML = [
        renderOcrCompleteness(expectedRows, parsedRows.length, missingRows, "draft", expectedTotal ? "total" : "circle"),
        renderParsedRows(parsedRows, "draft", "", columnCrops, rowCrops, skippedRowCrops),
      ].filter(Boolean).join("");
      bindDraftPreviewAfterRender(parsedRows);
    }
    const elapsed = state.draftImages.reduce((sum, image) => sum + (image.ocrElapsedMs || 0), 0);
    const countText = expectedTotal ? `總共 ${expectedTotal} 檔，` : (expectedRows ? `完整圈 ${expectedRows} 個，` : "");
    const missingText = missingRows ? `，可能少 ${missingRows} 筆` : "";
    setOcrStatus(parsedRows.length ? `完成，${countText}抓到 ${parsedRows.length} 筆候選庫存${missingText}（${formatDuration(elapsed)}）` : `完成，${countText}未抓到庫存列${missingText}（${formatDuration(elapsed)}）`);
  } catch (error) {
    console.error(error);
    setOcrStatus("解析失敗");
    alert(error.message || "截圖解析失敗，請重新整理後再試");
  } finally {
    els.parseDraft.disabled = state.draftImages.length === 0;
  }
}

function renderRowLineReview(review, imageIndex) {
  if (!review?.imageDataUrl) return "";
  const baseLines = review.linePercents || [];
  const extraLines = buildExtraRowLinePercents(baseLines, review.extraLineCount || 0);
  const lines = [
    ...baseLines.map((value) => ({ value, extra: false })),
    ...extraLines.map((value) => ({ value, extra: true })),
  ].sort((a, b) => a.value - b.value);
  return `
    <section class="row-line-review" data-row-line-review="${imageIndex}">
      <div class="ocr-completeness warning">
        <strong>請先調整截取線</strong>
        <p>${escapeHtml(review.reason || `紅圈需要 ${review.expectedLines} 條橫向截取線，目前自動偵測 ${review.detectedLines} 條。`)}直接拖曳圖上的紅線，讓線落在每兩列中間，再按「用截取線擷取」。</p>
      </div>
      <div class="row-line-stage">
        <img src="${review.imageDataUrl}" alt="截取線校準預覽">
        ${lines.map((line, index) => `<span class="row-line-overlay${line.extra ? " candidate" : ""}" data-line-overlay="${index}" style="top:${line.value}%">${Math.round(line.value)}%</span>`).join("")}
      </div>
    </section>
  `;
}

function renderRowLineApplyAction() {
  if (!els.parsePreview.querySelector("[data-row-line-review]")) return;
  if (els.parsePreview.querySelector("[data-row-line-apply-all]")) return;
  const actions = document.createElement("div");
  actions.className = "row-line-global-actions";
  actions.innerHTML = '<button class="button primary" type="button" data-row-line-apply-all>用截取線擷取</button>';
  els.parsePreview.appendChild(actions);
  actions.querySelector("[data-row-line-apply-all]")?.addEventListener("click", parseDraftImagesWithRowLines);
}

function buildExtraRowLinePercents(lines, count) {
  if (!count) return [];
  const sorted = [...(lines || [])].map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length < 2) return [];
  const gaps = sorted.slice(1)
    .map((line, index) => ({ start: sorted[index], end: line, gap: line - sorted[index] }))
    .sort((a, b) => b.gap - a.gap);
  const extras = [];
  for (let index = 0; index < count; index += 1) {
    const target = gaps[index % gaps.length];
    const parts = Math.floor(index / gaps.length) + 2;
    const slot = (index % gaps.length) + 1;
    extras.push(target.start + (target.gap * slot) / parts);
  }
  return extras;
}

function bindRowLineReviewControls(imageIndex) {
  const container = els.parsePreview.querySelector(`[data-row-line-review="${imageIndex}"]`);
  if (!container) return;
  container.querySelectorAll("[data-line-overlay]").forEach((overlay) => {
    overlay.style.cursor = "ns-resize";
    let dragging = false;
    const stage = container.querySelector(".row-line-stage");
    const startDrag = (e) => { dragging = true; e.preventDefault(); };
    const moveDrag = (e) => {
      if (!dragging || !stage) return;
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      let pct = ((clientY - rect.top) / rect.height) * 100;
      pct = Math.min(86, Math.max(18, pct));
      overlay.style.top = `${pct}%`;
      overlay.textContent = `${pct.toFixed(0)}%`;
    };
    const endDrag = () => { dragging = false; };
    overlay.addEventListener("mousedown", startDrag);
    overlay.addEventListener("touchstart", startDrag, { passive: false });
    document.addEventListener("mousemove", moveDrag);
    document.addEventListener("touchmove", moveDrag, { passive: false });
    document.addEventListener("mouseup", endDrag);
    document.addEventListener("touchend", endDrag);
  });
}

function collectDraftRowLinePercents() {
  return [...els.parsePreview.querySelectorAll("[data-row-line-review]")]
    .map((container) => {
      const imageIndex = Number(container.dataset.rowLineReview);
      const linePercents = [...container.querySelectorAll("[data-line-overlay]")]
        .map((overlay) => parseFloat(overlay.style.top))
        .filter(Number.isFinite);
      return Number.isInteger(imageIndex) && linePercents.length ? { imageIndex, linePercents } : null;
    })
    .filter(Boolean);
}

async function parseDraftImagesWithRowLines() {
  const calibrations = collectDraftRowLinePercents();
  if (!calibrations.length) return;
  const button = els.parsePreview.querySelector("[data-row-line-apply-all]");
  if (button) {
    button.disabled = true;
    button.textContent = "擷取中...";
  }
  setOcrStatus("使用調整後截取線解析所有圖片中...");
  try {
    const resultTextParts = [];
    for (let order = 0; order < calibrations.length; order += 1) {
      const { imageIndex, linePercents } = calibrations[order];
      const image = state.draftImages[imageIndex];
      if (!image) continue;
      const result = await recognizeImage(image, (progress, mode) => {
        setOcrStatus(`截取線解析 ${order + 1}/${calibrations.length}：${progress}%（${mode}）`);
      }, {
        maskEditButtons: els.kind.value === "ark_position",
        columnOcr: els.kind.value === "ark_position",
        rowLinePercents: linePercents,
      });
      image.pendingRowLineReview = null;
      image.parsedRows = result.rows || [];
      image.ocrElapsedMs = result.elapsedMs;
      image.rowOcrMs = result.rowOcrMs;
      image.rowCrops = result.rowCrops || [];
      image.skippedRowCrops = result.skippedRowCrops || [];
      image.expectedTotalCount = result.expectedTotalCount || image.expectedTotalCount || 0;
      image.completeCircleCount = result.completeCircleCount || image.completeCircleCount || 0;
      image.missingRowCount = result.missingRowCount || 0;
      image.rowLineReview = result.rowLineReview || image.rowLineReview || null;
      resultTextParts.push(result.text.trim());
    }

    const combinedText = resultTextParts.filter(Boolean).join("\n\n---\n\n");
    els.text.value = combinedText;
    const rows = state.draftImages.flatMap((image) => image.parsedRows || []);
    const parsedRows = rows.length ? dedupeRows(rows) : parseHoldings(els.text.value);
    const rowCrops = state.draftImages.flatMap((image) => image.rowCrops || []);
    const skippedRowCrops = state.draftImages.flatMap((image) => image.skippedRowCrops || []);
    const expectedTotal = Math.max(...state.draftImages.map((image) => image.expectedTotalCount || 0), 0);
    const expectedRows = expectedTotal || state.draftImages.reduce((sum, image) => sum + (image.completeCircleCount || 0), 0);
    const missingRows = expectedRows ? Math.max(0, expectedRows - parsedRows.length) : 0;
    els.parsePreview.innerHTML = [
      renderOcrCompleteness(expectedRows, parsedRows.length, missingRows, "draft", expectedTotal ? "total" : "circle"),
      renderParsedRows(parsedRows, "draft", "", [], rowCrops, skippedRowCrops),
    ].join("");
    bindDraftPreviewAfterRender(parsedRows);
    const elapsed = state.draftImages.reduce((sum, image) => sum + (image.ocrElapsedMs || 0), 0);
    setOcrStatus(`截圖解析完成，應有 ${expectedRows || "?"} 筆，目前解析 ${parsedRows.length} 筆${missingRows ? `，可能少 ${missingRows} 筆` : ""}（${formatDuration(elapsed)}）`);
  } catch (error) {
    console.error(error);
    setOcrStatus("截取線解析失敗");
    alert(error.message || "截取線解析失敗，請重新調整後再試。");
    if (button) {
      button.disabled = false;
      button.textContent = "用截取線擷取";
    }
  }
}

async function parseDraftImageWithRowLines(imageIndex) {
  const image = state.draftImages[imageIndex];
  const container = els.parsePreview.querySelector(`[data-row-line-review="${imageIndex}"]`);
  if (!image || !container) return;
  const linePercents = [...container.querySelectorAll("[data-row-line-input]")].map((input) => Number(input.value));
  const button = container.querySelector("#apply-row-lines");
  if (button) {
    button.disabled = true;
    button.textContent = "擷取中...";
  }
  setOcrStatus("使用調整後截取線解析中...");
  try {
    const result = await recognizeImage(image, (progress, mode) => {
      setOcrStatus(`使用調整線解析 ${progress}%（${mode}）`);
    }, {
      maskEditButtons: els.kind.value === "ark_position",
      columnOcr: els.kind.value === "ark_position",
      rowLinePercents: linePercents,
    });
    image.pendingRowLineReview = null;
    image.parsedRows = result.rows || [];
    image.ocrElapsedMs = result.elapsedMs;
    image.rowOcrMs = result.rowOcrMs;
    image.rowCrops = result.rowCrops || [];
    image.skippedRowCrops = result.skippedRowCrops || [];
    image.expectedTotalCount = result.expectedTotalCount || 0;
    image.completeCircleCount = result.completeCircleCount || 0;
    image.missingRowCount = result.missingRowCount || 0;
    els.text.value = result.text.trim();
    const parsedRows = dedupeRows(image.parsedRows || []);
    const expectedRows = image.expectedTotalCount || image.completeCircleCount || 0;
    els.parsePreview.innerHTML = [
      renderOcrCompleteness(expectedRows, parsedRows.length, Math.max(0, expectedRows - parsedRows.length), "draft", image.expectedTotalCount ? "total" : "circle"),
      renderParsedRows(parsedRows, "draft", "", [], image.rowCrops || [], image.skippedRowCrops || []),
    ].join("");
    bindDraftPreviewAfterRender(parsedRows);
    setOcrStatus(`完成，${image.expectedTotalCount ? `總共 ${image.expectedTotalCount} 檔` : `完整圈 ${image.completeCircleCount || 0} 個`}，抓到 ${parsedRows.length} 筆候選庫存（${formatDuration(result.elapsedMs || 0)}）`);
  } catch (error) {
    console.error(error);
    setOcrStatus("解析失敗");
    alert(error.message || "截圖解析失敗，請重新整理後再試");
    if (button) {
      button.disabled = false;
      button.textContent = "用截取線擷取";
    }
  }
}

async function parseExistingEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry?.images?.length) return;
  const button = els.detailContent.querySelector('[data-action="parse-entry"]');
  button.disabled = true;
  button.textContent = "解析中...";
  try {
    const result = await recognizeImage(entry.images[0], (progress, mode) => {
      button.textContent = `解析中 ${progress}%（${mode}）`;
    }, {
      maskEditButtons: entry.kind === "ark_position",
      columnOcr: entry.kind === "ark_position",
    });
    entry.text = result.text.trim();
    entry.parsedRows = Array.isArray(result.rows) ? result.rows : parseHoldings(entry.text);
    entry.ocrElapsedMs = result.elapsedMs;
    entry.columnOcrMs = result.columnOcrMs;
    entry.rowOcrMs = result.rowOcrMs;
    entry.columnCrops = result.columnCrops || [];
    entry.rowCrops = result.rowCrops || [];
    entry.skippedRowCrops = result.skippedRowCrops || [];
    entry.expectedTotalCount = result.expectedTotalCount || 0;
    entry.completeCircleCount = result.completeCircleCount || 0;
    entry.missingRowCount = result.missingRowCount || 0;
    entry.updatedAt = new Date().toISOString();
    await txStore("readwrite", (store) => store.put(entry));
    render();
    openDetail(id);
  } catch (error) {
    console.error(error);
    alert(error.message || "截圖解析失敗，請重新整理後再試");
    button.disabled = false;
    button.textContent = "重新解析截圖";
  }
}

function normalizeOcrText(text) {
  return String(text || "")
    .replace(/[０-９]/g, (value) => String.fromCharCode(value.charCodeAt(0) - 0xfee0))
    .replace(/[，]/g, ",")
    .replace(/[％]/g, "%")
    .replace(/[＋]/g, "+")
    .replace(/[－]/g, "-")
    .replace(/[|｜]/g, " ")
    .replace(/[：]/g, ":");
}

function parseNumberToken(token) {
  const normalized = String(token || "")
    .replace(/[,$]/g, "")
    .replace(/[()]/g, "")
    .replace(/[％%]/g, "")
    .replace(/[+]/g, "");
  if (!/^[-]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

function parseHoldings(text) {
  const normalized = normalizeOcrText(text);
  const lines = normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const arkRows = parseArkPositionRows(lines);
  if (arkRows.length) return dedupeRows(arkRows);

  return parseLineBasedRows(lines);
}

function parseArkRowCropText(text, cropDataUrl, label) {
  const normalized = normalizeOcrText(text);
  const compact = compactText(normalized);
  if (!/現\s*股/.test(normalized) || !compact.includes("現股")) return null;

  const holdingIndex = normalized.search(/現\s*股/);
  const numbers = extractNumbersAfterHolding(normalized);
  if (numbers.length < 2) return null;

  // 先辨識代號，決定是否為美股（影響均價標準化邏輯）
  const beforeHolding = holdingIndex >= 0 ? normalized.slice(0, holdingIndex) : normalized;
  const ocrName = cleanArkNamePart(beforeHolding);
  const symbol = findKnownSymbolInText(normalized) || findSymbolByOcrName(ocrName || normalized);
  const officialName = lookupSymbolName(symbol);

  // 股數：取第一個正數（美股允許小數股數，不限整數）
  const shares = numbers.find((value) => value > 0) ?? null;
  const rawAvgCost = numbers.find((value) => value !== shares && value > 0) ?? null;
  // 美股均價不套用 normalizeArkAvgCost（美股均價可合法 ≥1000，除以100會出錯）
  const avgCost = isUsSymbol(symbol) ? rawAvgCost : normalizeArkAvgCost(rawAvgCost);
  if (shares === null || avgCost === null) return null;

  return {
    symbol,
    name: officialName || ocrName,
    ocrName,
    kind: "現股",
    shares,
    avgCost,
    currentPrice: null,
    pnl: null,
    pnlRate: null,
    source: "ark_row_ocr",
    rawLine: normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(" / "),
    needsReview: !officialName,
    reviewReason: symbol ? "名稱待補" : "代號待補",
    crop: {
      key: label,
      label,
      dataUrl: cropDataUrl,
      text: normalized,
    },
  };
}

function normalizeArkAvgCost(value) {
  if (!Number.isFinite(value)) return null;
  if (Number.isInteger(value) && value >= 1000) {
    return Number((value / 100).toFixed(2));
  }
  return value;
}

function findKnownSymbolInText(text) {
  const compact = compactText(text).replace(/[^\dA-Za-z]/g, "").toUpperCase();
  const symbols = Object.keys(SYMBOL_NAMES).sort((a, b) => b.length - a.length);
  return symbols.find((symbol) => compact.includes(symbol)) || "";
}

function findSymbolByOcrName(text) {
  const normalized = normalizeStockNameForMatch(text);
  if (!normalized) return "";
  const aliases = {
    SO: "0053",
    S0: "0053",
    水: "2330",
  };
  if (aliases[normalized]) return aliases[normalized];
  const entries = Object.entries(SYMBOL_NAMES)
    .map(([symbol, name]) => ({ symbol, name, normalized: normalizeStockNameForMatch(name) }))
    .sort((a, b) => b.normalized.length - a.normalized.length);
  const exact = entries.find((item) => normalized.includes(item.normalized) || item.normalized.includes(normalized));
  if (exact) return exact.symbol;
  const scored = entries.map((item) => ({
    ...item,
    score: longestCommonSubsequenceLength(normalized, item.normalized) / Math.max(item.normalized.length, 1),
  })).sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 0.72 ? scored[0].symbol : "";
}

function normalizeStockNameForMatch(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "")
    .replace(/[臺台]/g, "台")
    .replace(/[脊驢]/g, "能")
    .replace(/[寓]/g, "富")
    .replace(/[一]/g, "5")
    .toUpperCase();
}

function longestCommonSubsequenceLength(a, b) {
  const previous = new Array(b.length + 1).fill(0);
  const current = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = a[i - 1] === b[j - 1]
        ? previous[j - 1] + 1
        : Math.max(previous[j], current[j - 1]);
    }
    previous.splice(0, previous.length, ...current);
    current.fill(0);
  }
  return previous[b.length] || 0;
}

function renderRowOcrText(result) {
  if (!result?.crops?.length && !result?.skipped?.length) return "";
  const imported = (result.crops || []).map((crop) => [
    `【${crop.label}】`,
    crop.text || "",
  ].join("\n"));
  const skipped = (result.skipped || []).map((crop) => [
    `【略過 ${crop.label}】`,
    crop.text || "",
  ].join("\n"));
  return [...imported, ...skipped].join("\n\n").trim();
}

function parseColumnOcrRows(column) {
  const nameRows = parseNameColumnRows(column.name || "");
  const shares = extractColumnNumbers(column.shares || "", "shares");
  const avgCosts = extractColumnNumbers(column.avgCost || "", "avgCost");
  const count = Math.max(nameRows.length, shares.length, avgCosts.length);
  const rows = [];

  for (let index = 0; index < count; index += 1) {
    const nameRow = nameRows[index] || {};
    const symbol = nameRow.symbol || "";
    const officialName = lookupSymbolName(symbol);
    const ocrName = nameRow.ocrName || "";
    rows.push({
      symbol,
      name: officialName || ocrName,
      ocrName,
      kind: "現股",
      shares: shares[index] ?? null,
      avgCost: avgCosts[index] ?? null,
      currentPrice: null,
      pnl: null,
      pnlRate: null,
      source: "ark_column_ocr",
      rawLine: [
        nameRow.rawLine,
        shares[index] !== undefined ? `股數:${shares[index]}` : "",
        avgCosts[index] !== undefined ? `均價:${avgCosts[index]}` : "",
      ].filter(Boolean).join(" | "),
      needsReview: !symbol || !officialName,
      reviewReason: symbol ? "名稱待補" : "代號待補",
    });
  }

  return rows;
}

function parseNameColumnRows(text) {
  const lines = normalizeOcrText(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isNoiseLine(line));
  const rows = [];
  const pending = [];

  for (const line of lines) {
    const symbol = exactSymbolFromLine(line);
    if (symbol) {
      rows.push({
        symbol,
        ocrName: compactText(pending.map(cleanArkNamePart).filter(Boolean).join("")),
        rawLine: [...pending, line].join(" / "),
      });
      pending.length = 0;
      continue;
    }
    pending.push(line);
  }

  if (pending.length) {
    rows.push({
      symbol: "",
      ocrName: compactText(pending.map(cleanArkNamePart).filter(Boolean).join("")),
      rawLine: pending.join(" / "),
    });
  }

  return rows;
}

function extractColumnNumbers(text, type) {
  const values = [];
  const lines = normalizeOcrText(text).split(/\r?\n/);
  for (const line of lines) {
    const matches = line.match(/[\d,]+(?:\.\d+)?/g) || [];
    for (const match of matches) {
      const value = parseNumberToken(match);
      if (value === null) continue;
      if (type === "shares" && !Number.isInteger(value)) continue;
      values.push(value);
    }
  }
  return values;
}

// 豎向欄位裁切專用：允許小數（美股小數股數），每行取最大正數
function extractColumnNumbersFlex(text) {
  const values = [];
  const lines = normalizeOcrText(text).split(/\r?\n/);
  for (const line of lines) {
    const matches = line.match(/[\d,]+(?:\.\d+)?/g) || [];
    const lineVals = matches
      .map(parseNumberToken)
      .filter((v) => v !== null && v > 0);
    if (lineVals.length > 0) values.push(Math.max(...lineVals));
  }
  return values;
}

function parseArkPositionRows(lines) {
  const rows = [];
  const pendingNameLines = [];
  const consumed = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    if (consumed.has(index)) continue;

    const line = lines[index];
    if (isNoiseLine(line)) continue;

    const holdingMatch = line.match(/現\s*股\s+([\d,]+)\s+([\d,.]+)/);
    if (!holdingMatch) {
      pendingNameLines.push(line);
      continue;
    }

    const beforeHolding = line.slice(0, holdingMatch.index).trim();
    const symbolInfo = findNearbySymbol(lines, index, pendingNameLines);
    if (symbolInfo?.index > index) consumed.add(symbolInfo.index);

    // fallback：若 findNearbySymbol 未找到代號，嘗試從名稱文字（含 beforeHolding）提取已知代號
    const symbol = symbolInfo?.symbol
      || findKnownSymbolInText([...pendingNameLines, beforeHolding].join(" "))
      || "";
    const ocrName = buildArkName(pendingNameLines, beforeHolding, symbol);
    const officialName = lookupSymbolName(symbol);
    const shares = parseNumberToken(holdingMatch[1]);
    const avgCost = parseNumberToken(holdingMatch[2]);

    rows.push({
      symbol,
      name: officialName || ocrName,
      ocrName,
      kind: "現股",
      shares,
      avgCost,
      currentPrice: null,
      pnl: null,
      pnlRate: null,
      source: "ark_position",
      rawLine: [pendingNameLines.join(" / "), line, symbolInfo?.line].filter(Boolean).join(" | "),
      needsReview: !officialName,
      reviewReason: symbol ? "名稱待補" : "代號待補",
    });

    pendingNameLines.length = 0;
  }

  return rows;
}

function parseLineBasedRows(lines) {
  const rows = [];

  for (const line of lines) {
    const symbolMatch = line.match(/\b(?:\d{4,6}|[A-Z]{1,5}(?:\.[A-Z]{1,3})?)\b/);
    if (!symbolMatch) continue;

    const symbol = symbolMatch[0];
    if (["TW", "US", "ETF", "TWD", "USD", "BUY", "SELL"].includes(symbol)) continue;

    const afterSymbol = line.slice(symbolMatch.index + symbol.length).trim();
    const tokens = afterSymbol.split(/\s+/).filter(Boolean);
    const numbers = tokens
      .map((token, index) => ({
        token,
        index,
        value: parseNumberToken(token),
        percent: /[%％]/.test(token),
      }))
      .filter((item) => item.value !== null);

    if (!numbers.length) continue;

    const nameTokens = tokens.slice(0, numbers[0].index).filter((token) => !/[+-]?\d/.test(token));
    const ocrName = nameTokens.join(" ");
    const shares = numbers.find((item) => Number.isInteger(item.value) && Math.abs(item.value) >= 1)?.value ?? null;
    const percent = numbers.find((item) => item.percent)?.value ?? null;
    const nonPercentNumbers = numbers.filter((item) => !item.percent);
    const firstPriceIndex = shares === null ? 0 : Math.max(0, nonPercentNumbers.findIndex((item) => item.value === shares) + 1);

    rows.push({
      symbol,
      name: lookupSymbolName(symbol) || ocrName,
      ocrName,
      kind: "",
      shares,
      avgCost: nonPercentNumbers[firstPriceIndex]?.value ?? null,
      currentPrice: nonPercentNumbers[firstPriceIndex + 1]?.value ?? null,
      pnl: nonPercentNumbers.find((item) => /^[+-]/.test(item.token))?.value ?? null,
      pnlRate: percent,
      rawLine: line,
    });
  }

  return rows;
}

function isNoiseLine(line) {
  return /^(《|編輯庫存|編輯 庫存|台股庫存|台 股 庫存|美股庫存|美 股 庫存|持有股票|持 有 股票|總共|總 共|新增持股|新 增 持 股)/.test(compactText(line));
}

function lookupSymbolName(symbol) {
  return SYMBOL_NAMES[String(symbol || "").toUpperCase()] || "";
}

// 台股 ETF 代號補 "00" 前綴（OCR 常漏掉）
// 規則：SYMBOL_NAMES 裡找不到原代號，但 "00"+代號 找得到 → 補上
function normalizeTWSymbol(symbol) {
  if (!symbol) return symbol;
  const s = String(symbol).toUpperCase().trim();
  if (SYMBOL_NAMES[s]) return s;           // 已知代號，直接用
  if (SYMBOL_NAMES["00" + s]) return "00" + s; // 漏 "00" → 補上
  return s;                                // 不在 SYMBOL_NAMES，維持原樣
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, "");
}

function isTwSymbol(value) {
  return /^\d{4,6}[A-Z]?$/.test(String(value || "").trim());
}

function isUsSymbol(value) {
  const s = String(value || "").trim().toUpperCase();
  return /^[A-Z]{1,5}$/.test(s) && Boolean(SYMBOL_NAMES[s]);
}

function findNearbySymbol(lines, index, pendingNameLines) {
  for (let offset = 1; offset <= 4; offset += 1) {
    const candidateLine = lines[index + offset];
    if (offset > 1 && /現\s*股\s+[\d,]+\s+[\d,.]+/.test(candidateLine || "")) break;
    const symbol = exactSymbolFromLine(candidateLine);
    if (symbol) return { symbol, index: index + offset, line: candidateLine };
  }

  for (let offset = pendingNameLines.length - 1; offset >= 0; offset -= 1) {
    const candidateLine = pendingNameLines[offset];
    const symbol = exactSymbolFromLine(candidateLine);
    if (symbol) return { symbol, index: -1, line: candidateLine };
  }

  return null;
}

function exactSymbolFromLine(line) {
  if (/[\u3400-\u9fff]/.test(String(line || ""))) return "";
  const compact = compactText(line).replace(/[^\dA-Za-z]/g, "").toUpperCase();
  if (isTwSymbol(compact)) return compact;
  if (isUsSymbol(compact)) return compact;
  return "";
}

function buildArkName(pendingNameLines, beforeHolding, symbol) {
  const parts = [...pendingNameLines, beforeHolding]
    .filter(Boolean)
    .filter((line) => exactSymbolFromLine(line) !== symbol)
    .map(cleanArkNamePart)
    .filter(Boolean);
  return compactText(parts.join(""));
}

function cleanArkNamePart(value) {
  let text = String(value || "")
    .replace(/現\s*股.*/, "")
    .replace(/\b\d{4,6}[A-Z]?\b/g, "")
    .replace(/\b([A-Z]{1,5})\b/g, (m) => SYMBOL_NAMES[m] ? "" : m)  // 美股代號
    .replace(/[\d,]+(?:\.\d+)?/g, "")
    .replace(/[《》\[\]「」"'`~!@#$%^&*_=+|\\/:;，。,.?？、三喧呈””-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = text.split(" ").filter(Boolean);
  if (tokens.length > 1 && /^(伍|全|愈|會|圖|師|朮|可|第)$/.test(tokens[0])) {
    tokens.shift();
  }

  text = tokens.join("");
  if (/^(持有股票|種類|總股數|成交均價|台股庫存|美股庫存)$/.test(text)) return "";
  return text;
}

function dedupeRows(rows) {
  const seen = new Map();
  const result = [];
  for (const row of rows) {
    if (!row.symbol) {
      result.push(row);
      continue;
    }
    // 台股 ETF 代號補 00（OCR 常漏前綴）
    const normalizedSymbol = normalizeTWSymbol(row.symbol);
    const normalizedRow = {
      ...row,
      symbol: normalizedSymbol,
      name: row.name || SYMBOL_NAMES[normalizedSymbol] || row.name || "",
    };
    if (seen.has(normalizedSymbol)) {
      result[seen.get(normalizedSymbol)] = normalizedRow;
      continue;
    }
    seen.set(normalizedSymbol, result.length);
    result.push(normalizedRow);
  }
  return result;
}

function displayValue(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return `${value}${suffix}`;
}

function formatDuration(ms) {
  if (!ms) return "0 秒";
  return `${(ms / 1000).toFixed(1)} 秒`;
}

function renderOcrTiming(entry) {
  if (!entry.ocrElapsedMs) return "";
  const cropMs = entry.rowOcrMs || entry.columnOcrMs;
  const cropLabel = entry.rowOcrMs ? "橫列" : "欄位";
  const columnText = cropMs ? `，${cropLabel} ${formatDuration(cropMs)}` : "";
  return `<div class="detail-field"><span>OCR 耗時</span><strong>${formatDuration(entry.ocrElapsedMs)}${columnText}</strong></div>`;
}

function renderOcrCompleteness(expectedRows, parsedRows, missingRows, context, source = "circle") {
  if (!expectedRows) return "";
  const complete = missingRows <= 0;
  const className = `${context === "detail" ? "detail-field" : "parsed-card"} ocr-completeness ${complete ? "complete" : "warning"}`;
  const label = source === "total" ? "總檔數檢查" : "完整圈數檢查";
  const body = source === "total"
    ? `畫面顯示總共 ${expectedRows} 檔，目前解析 ${parsedRows} 筆。`
    : `截圖前方完整圓圈 ${expectedRows} 個，目前解析 ${parsedRows} 筆。`;
  return `
    <div class="${className}">
      <span>${label}</span>
      <strong>${complete ? "解析筆數符合" : `可能少 ${missingRows} 筆`}</strong>
      <p>${body}</p>
    </div>
  `;
}

function renderParsedRows(rows, context, entryId = "", columnCrops = [], rowCrops = [], skippedRowCrops = []) {
  const rowDiagnostics = renderRowCropDiagnostics(rowCrops, skippedRowCrops);
  if (!rows?.length) {
    const skippedSection = renderSkippedRowCrops(skippedRowCrops);
    const crops = skippedSection || rowDiagnostics || renderColumnCrops(columnCrops);
    if (crops) {
      return `
        <div class="${context === "detail" ? "detail-field" : "parsed-card"}">
          <span>解析庫存</span>
          <div class="pre-wrap">尚未抓到庫存列</div>
          ${skippedSection}
          ${rowDiagnostics}
          ${renderColumnCrops(columnCrops)}
        </div>
      `;
    }
    return context === "detail"
      ? `<div class="detail-field"><span>解析庫存</span><div class="pre-wrap">尚未抓到庫存列</div></div>`
      : "";
  }
  const body = rows.map((row, index) => `
    <tr>
      <td>${renderRowCropCell(row)}</td>
      <td>${context === "draft" ? `<input class="cell-input" data-draft-symbol="${index}" type="text" value="${escapeHtml(row.symbol || "")}" placeholder="代號">` : escapeHtml(row.symbol || "待確認")}</td>
      <td>${context === "draft" ? `<input class="cell-input" data-draft-name="${index}" type="text" value="${escapeHtml(row.name || "")}" placeholder="名稱">` : escapeHtml(row.name)}</td>
      <td>${context === "draft" ? `<input class="cell-input" data-draft-kind="${index}" type="text" value="${escapeHtml(row.kind || "")}" placeholder="種類">` : escapeHtml(row.kind || "")}</td>
      <td>${context === "draft" ? `<input class="cell-input" data-draft-shares="${index}" type="number" step="0.001" value="${escapeHtml(String(row.shares ?? ""))}" placeholder="股數">` : escapeHtml(displayValue(row.shares))}</td>
      <td>${context === "draft" ? `<input class="cell-input" data-draft-avgcost="${index}" type="number" step="0.001" value="${escapeHtml(String(row.avgCost ?? ""))}" placeholder="均價">` : escapeHtml(displayValue(row.avgCost))}</td>
      <td>${escapeHtml(row.needsReview ? row.reviewReason || "待確認" : "")}</td>
      ${context !== "draft" ? `<td>${renderRowFixCell(row, index, context, entryId)}</td>` : ""}
      <td class="raw-cell">${escapeHtml(row.rawLine || "")}</td>
    </tr>
  `).join("");
  const containerClass = context === "detail"
    ? "detail-field"
    : `parsed-card ${context === "draft" ? "draft-parsed-card" : ""}`;
  return `
    <div class="${containerClass}">
      <span>解析庫存</span>
      <div class="table-scroll ${context === "draft" ? "draft-table-scroll" : ""}">
        <table class="parsed-table ${context === "draft" ? "draft-parsed-table" : ""}">
          <thead>
            <tr>
              <th>截圖</th>
              <th>代號</th>
              <th>名稱</th>
              <th>種類</th>
              <th>股數</th>
              <th>成交均價</th>
              <th>狀態</th>
              ${context !== "draft" ? "<th>修正</th>" : ""}
              <th>OCR 區塊</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      ${renderSkippedRowCrops(skippedRowCrops)}
      ${rowDiagnostics}
      ${renderColumnCrops(columnCrops)}
    </div>
  `;
}

function renderRowCropCell(row) {
  if (!row?.crop?.dataUrl) return "";
  return `
    <figure class="row-crop">
      <img src="${row.crop.dataUrl}" alt="${escapeHtml(row.crop.label || "個股橫列裁切")}">
      <figcaption>${escapeHtml(row.crop.label || "")}</figcaption>
    </figure>
  `;
}

function renderSkippedRowCrops(skippedRowCrops) {
  const crops = (skippedRowCrops || []).filter((c) => c?.dataUrl && c.status !== "imported");
  if (!crops.length) return "";
  const items = crops.map((crop, i) => {
    const text = String(crop.text || "").trim();
    return `
      <div class="skipped-row-item">
        <div class="skipped-row-header">
          <img src="${crop.dataUrl}" alt="${escapeHtml(crop.label || "未解析橫列")}">
          <div class="skipped-row-info">
            <strong>${escapeHtml(crop.label || `列 ${i + 1}`)}</strong>
            <small>${escapeHtml(text || "OCR 沒辨識到文字")}</small>
          </div>
          <button class="skipped-row-dismiss" type="button" data-dismiss-skipped title="移除此列">×</button>
        </div>
        <div class="skipped-row-inputs">
          <input class="cell-input" type="text" placeholder="代號*" data-skipped-symbol autocomplete="off">
          <input class="cell-input" type="text" placeholder="名稱" data-skipped-name autocomplete="off">
          <input class="cell-input" type="number" placeholder="股數*" step="0.001" min="0" data-skipped-shares>
          <input class="cell-input" type="number" placeholder="均價" step="0.001" min="0" data-skipped-avgcost>
          <button class="button secondary compact" type="button" data-add-skipped>加入草稿</button>
        </div>
      </div>
    `;
  }).join("");
  return `
    <div class="skipped-rows-section">
      <strong>未解析的列（${crops.length} 列）</strong>
      ${items}
    </div>
  `;
}

function renderRowCropDiagnostics(rowCrops, skippedRowCrops = []) {
  const unique = [];
  const seen = new Set();
  for (const crop of (rowCrops || [])) {
    const key = crop?.key || crop?.dataUrl;
    if (!crop?.dataUrl || seen.has(key)) continue;
    seen.add(key);
    unique.push(crop);
  }
  if (!unique.length) return "";

  const items = unique.map((crop) => {
    const imported = crop.status === "imported";
    const statusText = crop.fallback ? "備援候選" : (imported ? "已進庫存" : "未匯入");
    const text = String(crop.text || "").trim();
    return `
      <figure class="diagnostic-crop ${imported ? "imported" : "skipped"} ${crop.fallback ? "fallback" : ""}">
        <img src="${crop.dataUrl}" alt="${escapeHtml(crop.label || "個股橫列裁切")}">
        <figcaption>
          <strong>${escapeHtml(crop.label || "橫列")}</strong>
          <span>${statusText}</span>
          <small>${escapeHtml(text || "OCR 沒辨識到文字")}</small>
        </figcaption>
      </figure>
    `;
  }).join("");

  const content = `
    <div class="row-diagnostics" aria-label="個股橫列裁切診斷">
      ${items}
    </div>
  `;
  return `
    <details class="diagnostics-details">
      <summary>分析明細（${unique.length} 列）</summary>
      ${content}
    </details>
  `;
}

function renderColumnCrops(crops) {
  if (!Array.isArray(crops) || !crops.length) return "";
  const items = crops.map((crop) => `
    <figure class="column-crop">
      <img src="${crop.dataUrl || ""}" alt="${escapeHtml(crop.label || "欄位裁切")}">
      <figcaption>${escapeHtml(crop.label || "欄位裁切")}</figcaption>
    </figure>
  `).join("");
  return `
    <div class="column-crops" aria-label="固定欄位裁切對照">
      ${items}
    </div>
  `;
}

function renderRowFixCell(row, index, context, entryId) {
  if (context !== "detail" || !entryId) return "";
  return `
    <div class="row-fix">
      <label>代號<input data-symbol-input="${index}" type="text" inputmode="text" value="${escapeHtml(row.symbol || "")}"></label>
      <label>股數<input data-shares-input="${index}" type="number" step="0.001" inputmode="decimal" value="${escapeHtml(row.shares ?? "")}"></label>
      <label>均價<input data-avg-cost-input="${index}" type="number" step="0.001" inputmode="decimal" value="${escapeHtml(row.avgCost ?? "")}"></label>
      <button class="button secondary compact" type="button" data-action="apply-row-fix" data-row-index="${index}">套用</button>
    </div>
  `;
}

function closeDetail() {
  els.detail.classList.remove("is-open");
}

function openCapturePanel() {
  els.capturePanel.hidden = false;
}

function closeCapturePanel() {
  els.capturePanel.hidden = true;
}

async function updateStatus(id, status) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  entry.status = status;
  entry.updatedAt = new Date().toISOString();
  await txStore("readwrite", (store) => store.put(entry));
  render();
  openDetail(id);
}

async function deleteEntry(id) {
  await txStore("readwrite", (store) => store.delete(id));
  state.entries = state.entries.filter((item) => item.id !== id);
  closeDetail();
  render();
}

// D1：清除截圖圖片（保留 entry metadata）
async function clearEntryImages(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  entry.images = (entry.images || []).map((img) => ({ ...img, dataUrl: "" }));
  entry.updatedAt = new Date().toISOString();
  await txStore("readwrite", (store) => store.put(entry));
  render();
  openDetail(id);
}

// 批量清除：壞標題（含 ${els.）且狀態為已匯入的 entry → 直接刪除
async function bulkClearOldEntries() {
  const badEntries = state.entries.filter(
    (e) => e.status === "imported" && e.title?.includes("${els.")
  );
  if (!badEntries.length) { alert("沒有符合條件的舊截圖（壞標題 + 已匯入）。"); return; }
  const confirmed = confirm(`找到 ${badEntries.length} 筆壞標題且已匯入的舊截圖，資料已在 Sheet，確定刪除本地紀錄？`);
  if (!confirmed) return;
  const ids = new Set(badEntries.map((e) => e.id));
  await txStore("readwrite", (store) => {
    for (const id of ids) store.delete(id);
  });
  state.entries = state.entries.filter((e) => !ids.has(e.id));
  render();
  alert(`已刪除 ${ids.size} 筆舊截圖紀錄。`);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeClientId(value) {
  const clientId = String(value || "").trim();
  return clientId && !LEGACY_GOOGLE_CLIENT_IDS.has(clientId) ? clientId : DEFAULT_GOOGLE_CLIENT_ID;
}

function getSheetSyncConfig() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHEET_SYNC_CONFIG_KEY) || "{}");
    return {
      spreadsheetId: parsed.spreadsheetId || DEFAULT_SPREADSHEET_ID,
      clientId: normalizeClientId(parsed.clientId),
      authorizedEmail: DEFAULT_AUTHORIZED_EMAIL,
    };
  } catch {
    return { spreadsheetId: DEFAULT_SPREADSHEET_ID, clientId: DEFAULT_GOOGLE_CLIENT_ID, authorizedEmail: DEFAULT_AUTHORIZED_EMAIL };
  }
}

function saveSheetSyncConfig(config) {
  localStorage.setItem(SHEET_SYNC_CONFIG_KEY, JSON.stringify({
    spreadsheetId: config.spreadsheetId || DEFAULT_SPREADSHEET_ID,
    clientId: normalizeClientId(config.clientId),
  }));
}

function resetGoogleSession(message = "請使用授權的 Google 帳號登入。") {
  googleTokenClient = null;
  googleAccessToken = "";
  googleAccessTokenExpiresAt = 0;
  state.auth = {
    signedIn: false,
    authorized: false,
    email: "",
    message,
  };
  setAppLocked(true);
  renderAuthGate();
}

function configureSheetSync() {
  const current = getSheetSyncConfig();
  const spreadsheetId = prompt("Google Sheet ID", current.spreadsheetId || DEFAULT_SPREADSHEET_ID);
  if (spreadsheetId === null) return null;
  const clientId = prompt("Google OAuth Client ID（Web application）", normalizeClientId(current.clientId));
  if (clientId === null) return null;
  const config = {
    spreadsheetId: spreadsheetId.trim() || DEFAULT_SPREADSHEET_ID,
    clientId: normalizeClientId(clientId),
    authorizedEmail: DEFAULT_AUTHORIZED_EMAIL,
  };
  saveSheetSyncConfig(config);
  resetGoogleSession(config.clientId
    ? "設定已儲存，請使用授權帳號登入。"
    : "請補齊 OAuth Client ID。");
  return config;
}

function setAppLocked(locked) {
  els.appShell?.classList.toggle("is-locked", locked);
  if (els.authGate) els.authGate.hidden = !locked;
}

function renderAuthGate(message = "") {
  if (!els.authGate) return;
  const config = getSheetSyncConfig();
  const status = message || state.auth.message || "請使用授權的 Google 帳號登入。";
  els.authStatus.textContent = status;
  els.authEmail.textContent = config.authorizedEmail
    ? `允許帳號：${config.authorizedEmail}`
    : "允許帳號未設定";
  els.authSignIn.disabled = !config.clientId || !config.authorizedEmail;
  els.authSignIn.textContent = state.auth.authorized ? "已登入" : "使用 Google 登入";
}

function ensureAuthConfig() {
  const config = getSheetSyncConfig();
  if (config.clientId) return config;
  const updated = configureSheetSync();
  if (!updated?.clientId) {
    throw new Error("請先設定 OAuth Client ID");
  }
  return updated;
}

async function fetchGoogleProfile(token) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `Google profile ${response.status}`);
  }
  return payload;
}

function authorizeGoogleProfile(profile, config = getSheetSyncConfig()) {
  const email = normalizeEmail(profile.email || "");
  const allowed = normalizeEmail(config.authorizedEmail || "");
  if (!email) throw new Error("Google 帳號沒有回傳 email，請重新登入。");
  if (!allowed) throw new Error("允許登入的 Google Email 尚未設定");
  if (email !== allowed) {
    state.auth = {
      signedIn: true,
      authorized: false,
      email,
      message: `此 Google 帳號未授權：${email}`,
    };
    setAppLocked(true);
    renderAuthGate();
    throw new Error(`此 Google 帳號未授權：${email}`);
  }
  state.auth = {
    signedIn: true,
    authorized: true,
    email,
    message: `已登入：${email}`,
  };
  renderAuthGate();
  return email;
}

async function ensureGoogleIdentity() {
  if (window.google?.accounts?.oauth2) return;
  if (!googleIdentityLoadPromise) {
    googleIdentityLoadPromise = loadScript(
      GOOGLE_ID_SCRIPT_URL,
      () => Boolean(window.google?.accounts?.oauth2),
      "Google 登入模組",
    );
  }
  await googleIdentityLoadPromise;
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google 登入模組載入後仍不可用，請重新整理後再試");
  }
}

async function getGoogleAccessToken() {
  const config = ensureAuthConfig();
  if (googleAccessToken && Date.now() < googleAccessTokenExpiresAt && state.auth.authorized) return googleAccessToken;

  await ensureGoogleIdentity();
  const latestConfig = getSheetSyncConfig();
  if (!googleTokenClient) {
    googleTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: latestConfig.clientId,
      scope: `${GOOGLE_AUTH_SCOPE} ${GOOGLE_SHEETS_SCOPE}`,
      callback: () => {},
    });
  }

  return new Promise((resolve, reject) => {
    googleTokenClient.callback = async (response) => {
      try {
        if (response.error) {
          throw new Error(response.error_description || response.error);
        }
        googleAccessToken = response.access_token;
        googleAccessTokenExpiresAt = Date.now() + ((response.expires_in || 3600) * 1000) - 60000;
        const profile = await fetchGoogleProfile(googleAccessToken);
        authorizeGoogleProfile(profile, latestConfig);
        resolve(googleAccessToken);
      } catch (error) {
        googleAccessToken = "";
        googleAccessTokenExpiresAt = 0;
        reject(error);
      }
    };
    googleTokenClient.requestAccessToken({ prompt: googleAccessToken ? "" : "consent" });
  });
}

async function sheetsFetch(path, options = {}) {
  const config = getSheetSyncConfig();
  if (!config.spreadsheetId) throw new Error("尚未設定 Google Sheet ID");
  const token = await getGoogleAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.spreadsheetId)}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `Google Sheets API ${response.status}`);
  }
  return payload;
}

function sheetRange(sheetName, range = "") {
  return encodeURIComponent(`${sheetName}${range ? `!${range}` : ""}`);
}

async function readSheetValues(sheetName, range) {
  const payload = await sheetsFetch(`/values/${sheetRange(sheetName, range)}`);
  return payload.values || [];
}

function parseGoogleVisualizationValues(payloadOrText) {
  const payload = typeof payloadOrText === "string"
    ? JSON.parse(String(payloadOrText || "")
      .replace(/^[\s\S]*google\.visualization\.Query\.setResponse\(/, "")
      .replace(/\);?\s*$/, ""))
    : payloadOrText;
  if (payload.status === "error") {
    throw new Error(payload.errors?.[0]?.detailed_message || payload.errors?.[0]?.reason || "Google Sheet 讀取失敗");
  }
  return (payload.table?.rows || []).map((row) => (row.c || []).map((cell) => cell?.v ?? ""));
}

async function readPublicSheetValues(sheetName) {
  return new Promise((resolve, reject) => {
    const callbackName = `assetflowInvestSheet_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("讀取 Google Sheet 逾時，請確認 2026 Invest 是否允許知道連結的人檢視"));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      script.remove();
      delete window[callbackName];
    }

    window[callbackName] = (payload) => {
      try {
        const values = parseGoogleVisualizationValues(payload);
        cleanup();
        resolve(values);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("讀取 Google Sheet 失敗，請確認 2026 Invest 是否允許知道連結的人檢視"));
    };
    script.src = `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/gviz/tq?tqx=${encodeURIComponent(`out:json;responseHandler:${callbackName}`)}&sheet=${encodeURIComponent(sheetName)}`;
    document.head.appendChild(script);
  });
}

async function readCloudSheetValues(sheetName, range) {
  return readSheetValues(sheetName, range);
}

async function updateSheetValues(sheetName, range, values) {
  return sheetsFetch(`/values/${sheetRange(sheetName, range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ majorDimension: "ROWS", values }),
  });
}

async function appendSheetValues(sheetName, range, values) {
  return sheetsFetch(`/values/${sheetRange(sheetName, range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ majorDimension: "ROWS", values }),
  });
}

async function clearSheetValues(sheetName, range) {
  return sheetsFetch(`/values/${sheetRange(sheetName, range)}:clear`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

async function ensureSheetTables() {
  const metadata = await sheetsFetch("?fields=sheets.properties.title");
  const titles = new Set((metadata.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean));
  const requests = Object.values(SHEET_NAMES)
    .filter((title) => !titles.has(title))
    .map((title) => ({ addSheet: { properties: { title } } }));

  if (requests.length) {
    await sheetsFetch(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
  }

  await updateSheetValues(SHEET_NAMES.snapshots, "A1:H1", [SHEET_HEADERS.snapshots]);
  await updateSheetValues(SHEET_NAMES.positions, "A1:J1", [SHEET_HEADERS.positions]);
  await updateSheetValues(SHEET_NAMES.layout, "A1:G1", [SHEET_HEADERS.layout]);
  await updateSheetValues(SHEET_NAMES.firstBuy, "A1:C1", [SHEET_HEADERS.firstBuy]);
}

async function ensureCloudSheetTables() {
  if (sheetTablesReady) return;
  await ensureSheetTables();
  sheetTablesReady = true;
}

function validSnapshotRows(rows) {
  const seen = new Map();
  const filtered = (rows || []).filter((row) =>
    row?.symbol &&
    row?.shares !== null && row?.shares !== undefined &&
    row?.avgCost !== null && row?.avgCost !== undefined
  );
  // 同代號取最後一筆；代號補 00；空名稱從 SYMBOL_NAMES 補查
  for (const row of filtered) {
    const sym = normalizeTWSymbol(row.symbol);
    seen.set(sym, {
      ...row,
      symbol: sym,
      name: row.name || SYMBOL_NAMES[sym] || row.name || "",
    });
  }
  return [...seen.values()];
}

function snapshotId(createdAt = new Date().toISOString()) {
  return `snap_${createdAt.replace(/[-:.TZ]/g, "")}_${Math.random().toString(16).slice(2, 8)}`;
}

function buildSnapshotPayload(entry) {
  const rows = validSnapshotRows(entry.parsedRows || parseHoldings(entry.text || ""));
  const createdAt = new Date().toISOString();
  const id = snapshotId(createdAt);
  return buildSnapshotPayloadFromRows({
    snapshotId: id,
    createdAt,
    date: entry.date || today(),
    market: entry.market || "",
    sourceEntryId: entry.id,
    sourceTitle: entry.title || "",
    rows,
  });
}

function splitRowsByMarket(rows, fallbackMarket = "") {
  const fallbackKey = normalizeMarketKey(fallbackMarket);
  const groups = { TW: [], US: [] };
  for (const row of rows || []) {
    const market = ["TW", "US"].includes(fallbackKey) ? fallbackKey : marketForPosition(row);
    if (!["TW", "US"].includes(market)) continue;
    groups[market].push({ ...row, market });
  }
  return Object.entries(groups)
    .filter(([, groupRows]) => groupRows.length)
    .map(([market, groupRows]) => ({ market, rows: groupRows }));
}

function buildMarketSnapshotPayloadsFromRows({ createdAt, date, market, sourceEntryId, sourceTitle, rows }) {
  return splitRowsByMarket(rows, market).map((group) => buildSnapshotPayloadFromRows({
    snapshotId: snapshotId(createdAt),
    createdAt,
    date,
    market: group.market,
    sourceEntryId,
    sourceTitle,
    rows: group.rows,
  }));
}

function buildMarketSnapshotPayloads(entry) {
  const rows = validSnapshotRows(entry.parsedRows || parseHoldings(entry.text || ""));
  return buildMarketSnapshotPayloadsFromRows({
    createdAt: new Date().toISOString(),
    date: entry.date || today(),
    market: entry.market || "",
    sourceEntryId: entry.id,
    sourceTitle: entry.title || "",
    rows,
  });
}

function buildSnapshotPayloadFromRows({ snapshotId: id, createdAt, date, market, sourceEntryId, sourceTitle, rows }) {
  return {
    snapshotId: id,
    createdAt,
    snapshotRow: [
      id,
      createdAt,
      date || today(),
      market || "",
      sourceEntryId || "",
      sourceTitle || "",
      rows.length,
      APP_VERSION,
    ],
    positionRows: rows.map((row) => [
      id,
      date || today(),
      market || "",
      row.symbol || "",
      row.name || "",
      row.kind || "",
      row.shares ?? "",
      row.avgCost ?? "",
      row.source || "",
      createdAt,
    ]),
  };
}

function normalizeSnapshotNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(6) : "0.000000";
}

function positionSignature(rows) {
  return (rows || [])
    .filter((row) => row?.symbol)
    .map((row) => [
      String(row.symbol || "").trim(),
      normalizeSnapshotNumber(row.shares),
      normalizeSnapshotNumber(row.avgCost),
    ].join(":"))
    .sort()
    .join("|");
}

function snapshotDuplicateKey(snapshot, rows) {
  return [
    String(snapshot?.date || "").trim(),
    String(snapshot?.market || "").trim(),
    positionSignature(rows),
  ].join("::");
}

function snapshotPositionsFromList(snapshotId, positions) {
  return (positions || []).filter((row) => row.snapshotId === snapshotId);
}

function findExistingDuplicateSnapshot({ date, market, rows }) {
  const targetKey = snapshotDuplicateKey({ date, market }, rows);
  return (state.cloudHistory.snapshots || []).find((snapshot) => {
    const rowsForSnapshot = snapshotPositionsFromList(snapshot.snapshotId, state.cloudHistory.positions);
    return snapshotDuplicateKey(snapshot, rowsForSnapshot) === targetKey;
  });
}

function findDailySnapshots(date, market) {
  const normalizedDate = normalizeDateText(date);
  const normalizedMarket = normalizeMarketKey(market);
  return (state.cloudHistory.snapshots || []).filter((snapshot) => (
    normalizeDateText(snapshot.date) === normalizedDate
    && normalizeMarketKey(snapshot.market) === normalizedMarket
  ));
}

function compareSnapshotRows(existingRows, newRows) {
  const existingMap = rowsBySymbol(existingRows);
  const newMap = rowsBySymbol(newRows);
  const symbols = [...new Set([...existingMap.keys(), ...newMap.keys()])].sort();
  const added = [];
  const removed = [];
  const changed = [];

  for (const symbol of symbols) {
    const previous = existingMap.get(symbol);
    const current = newMap.get(symbol);
    if (!previous && current) {
      added.push(current);
      continue;
    }
    if (previous && !current) {
      removed.push(previous);
      continue;
    }
    const previousShares = Number(previous?.shares || 0);
    const currentShares = Number(current?.shares || 0);
    const previousCost = Number(previous?.avgCost || 0);
    const currentCost = Number(current?.avgCost || 0);
    if (normalizeSnapshotNumber(previousShares) !== normalizeSnapshotNumber(currentShares)
      || normalizeSnapshotNumber(previousCost) !== normalizeSnapshotNumber(currentCost)) {
      changed.push({
        symbol,
        name: current?.name || previous?.name || "",
        previousShares,
        currentShares,
        previousCost,
        currentCost,
      });
    }
  }

  return { added, removed, changed };
}

function snapshotDiffLine(row) {
  return `${row.symbol}${row.name ? ` ${row.name}` : ""}：${formatNumber(row.shares, 3)} 股 / ${formatNumber(row.avgCost, 3)}`;
}

function formatSnapshotDiff(diff, limit = 18) {
  const lines = [];
  for (const row of diff.added) lines.push(`新增 ${snapshotDiffLine(row)}`);
  for (const row of diff.removed) lines.push(`移除 ${snapshotDiffLine(row)}`);
  for (const row of diff.changed) {
    lines.push(`變更 ${row.symbol}${row.name ? ` ${row.name}` : ""}：股數 ${formatNumber(row.previousShares, 3)} → ${formatNumber(row.currentShares, 3)}，均價 ${formatNumber(row.previousCost, 3)} → ${formatNumber(row.currentCost, 3)}`);
  }
  if (lines.length > limit) {
    return [...lines.slice(0, limit), `...另有 ${lines.length - limit} 筆差異`].join("\n");
  }
  return lines.join("\n");
}

async function writeMarketSnapshotPayloads(payloads) {
  const actions = [];
  const skipped = [];

  for (const payload of payloads) {
    const date = payload.snapshotRow[2];
    const market = payload.snapshotRow[3];
    const newRows = payload.positionRows.map((row) => ({
      snapshotId: row[0],
      date: row[1],
      market: row[2],
      symbol: row[3],
      name: row[4],
      kind: row[5],
      shares: Number(row[6] || 0),
      avgCost: Number(row[7] || 0),
      source: row[8],
      createdAt: row[9],
    }));
    const existingSnapshots = findDailySnapshots(date, market);
    if (!existingSnapshots.length) {
      actions.push({ type: "insert", payload, existingSnapshots: [] });
      continue;
    }

    const existingRows = existingSnapshots.flatMap((snapshot) => snapshotPositionsFromList(snapshot.snapshotId, state.cloudHistory.positions));
    const diff = compareSnapshotRows(existingRows, newRows);
    const diffText = formatSnapshotDiff(diff);
    if (!diffText) {
      skipped.push({ payload, existingSnapshot: existingSnapshots[0] });
      continue;
    }

    const confirmed = confirm([
      `雲端已存在 ${date} ${marketLabel(market)} 快照 ${existingSnapshots.length} 筆。`,
      "差異：",
      diffText,
      "",
      "是否用這次最新快照取代同日同市場的舊快照？",
    ].join("\n"));
    if (!confirmed) return { cancelled: true, written: [], skipped };
    actions.push({ type: "replace", payload, existingSnapshots });
  }

  if (!actions.length) return { cancelled: false, written: [], skipped };

  const replaceIds = new Set(actions
    .filter((action) => action.type === "replace")
    .flatMap((action) => action.existingSnapshots.map((snapshot) => snapshot.snapshotId)));
  const hasReplacement = replaceIds.size > 0;

  if (hasReplacement) {
    const keptSnapshots = (state.cloudHistory.snapshots || [])
      .filter((snapshot) => !replaceIds.has(snapshot.snapshotId))
      .map(snapshotToSheetRow);
    const keptPositions = (state.cloudHistory.positions || [])
      .filter((row) => !replaceIds.has(row.snapshotId))
      .map(positionToSheetRow);
    const nextSnapshots = [...keptSnapshots, ...actions.map((action) => action.payload.snapshotRow)];
    const nextPositions = [...keptPositions, ...actions.flatMap((action) => action.payload.positionRows)];

    await clearSheetValues(SHEET_NAMES.snapshots, "A2:H");
    await clearSheetValues(SHEET_NAMES.positions, "A2:J");
    if (nextSnapshots.length) await updateSheetValues(SHEET_NAMES.snapshots, "A2:H", nextSnapshots);
    if (nextPositions.length) await updateSheetValues(SHEET_NAMES.positions, "A2:J", nextPositions);
  } else {
    await appendSheetValues(SHEET_NAMES.snapshots, "A:H", actions.map((action) => action.payload.snapshotRow));
    await appendSheetValues(SHEET_NAMES.positions, "A:J", actions.flatMap((action) => action.payload.positionRows));
  }

  return {
    cancelled: false,
    written: actions.map((action) => action.payload),
    skipped,
    replacedCount: replaceIds.size,
  };
}

// 從現有快照重建 AssetFlowLayout 完整歷史（Layout tab 是空的時才需用）
async function rebuildLayoutHistory() {
  if (!state.auth.authorized) { alert("請先登入"); return; }
  const snapshots = (state.cloudHistory.snapshots || [])
    .slice()
    .sort((a, b) => String(a.date || a.createdAt).localeCompare(String(b.date || b.createdAt)));
  const positions = state.cloudHistory.positions || [];
  if (!snapshots.length) { alert("沒有快照資料"); return; }
  if (!confirm(`即將從 ${snapshots.length} 個快照重建 AssetFlowLayout 歷史。\n舊資料會先清空再重寫。確定？`)) return;
  try {
    await ensureCloudSheetTables();
    // 先清空 layout 資料列
    await clearSheetValues(SHEET_NAMES.layout, "A2:G");
    const rows = [];
    // 以 market 為 key，依日期排序的快照 list
    const byMarket = {};
    for (const s of snapshots) {
      const mk = normalizeMarketKey(s.market) || "TW";
      if (!byMarket[mk]) byMarket[mk] = [];
      byMarket[mk].push(s);
    }
    for (const [market, mktSnaps] of Object.entries(byMarket)) {
      for (let i = 0; i < mktSnaps.length; i++) {
        const snap = mktSnaps[i];
        const curPos = positions.filter((p) => p.snapshotId === snap.snapshotId);
        const prevPos = i > 0
          ? positions.filter((p) => p.snapshotId === mktSnaps[i - 1].snapshotId)
          : [];
        for (const pos of curPos) {
          const prev = prevPos.find((p) => p.symbol === pos.symbol);
          const prevShares = prev ? Number(prev.shares ?? 0) : 0;
          const delta = Number(pos.shares ?? 0) - prevShares;
          if (delta !== 0 || !prev) {
            rows.push([snap.date || "", market, pos.symbol, pos.name || "", Number(pos.shares ?? 0), prevShares, delta]);
          }
        }
      }
    }
    if (rows.length) await updateSheetValues(SHEET_NAMES.layout, `A2:G${rows.length + 1}`, rows);
    await loadLatestCloudSnapshot(false);
    alert(`已重建 ${rows.length} 筆布局歷史，請重新整理 B tab 查看累積布局進度。`);
  } catch (err) {
    console.error(err);
    alert(err.message || "重建失敗");
  }
}

async function saveLayoutDeltaToSheet(newPayloads) {
  if (!newPayloads?.length) return;
  try {
    const allPositions = state.cloudHistory?.positions || [];
    const allSnapshots = state.cloudHistory?.snapshots || [];
    const rows = [];
    for (const payload of newPayloads) {
      const { date, market } = payload;
      const newRows = payload.positionRows.map((r) => ({
        symbol: r[3], name: r[4], shares: Number(r[6] ?? 0),
      }));
      // find previous snapshot for this market (before this date)
      const prevSnapshot = allSnapshots
        .filter((s) => normalizeMarketKey(s.market) === normalizeMarketKey(market) && (s.date || "") < date)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      const prevPositions = prevSnapshot
        ? allPositions.filter((p) => p.snapshotId === prevSnapshot.snapshotId)
        : [];
      for (const newRow of newRows) {
        const prev = prevPositions.find((p) => p.symbol === newRow.symbol);
        const prevShares = prev ? Number(prev.shares ?? 0) : 0;
        const delta = newRow.shares - prevShares;
        if (delta !== 0 || !prev) {
          rows.push([date, market, newRow.symbol, newRow.name, newRow.shares, prevShares, delta]);
        }
      }
    }
    if (rows.length) {
      await appendSheetValues(SHEET_NAMES.layout, "A:G", rows);
    }
  } catch (error) {
    console.warn("saveLayoutDeltaToSheet", error);
  }
}

function findDuplicateSnapshotGroups(snapshots, positions) {
  const groups = new Map();
  for (const snapshot of snapshots || []) {
    const rows = snapshotPositionsFromList(snapshot.snapshotId, positions);
    const key = snapshotDuplicateKey(snapshot, rows);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ snapshot, rows });
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => group.sort((a, b) => String(b.snapshot.createdAt).localeCompare(String(a.snapshot.createdAt))));
}

function cloudSnapshotDates() {
  return [...new Set((state.cloudHistory.snapshots || [])
    .map((snapshot) => normalizeDateText(snapshot.date))
    .filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
}

function snapshotsForDeletion(snapshots, date, market) {
  const normalizedDate = normalizeDateText(date);
  const normalizedMarket = normalizeMarketKey(market);
  if (!normalizedDate) return [];
  return (snapshots || []).filter((snapshot) => {
    const sameDate = normalizeDateText(snapshot.date) === normalizedDate;
    const sameMarket = normalizedMarket === "ALL" || normalizeMarketKey(snapshot.market) === normalizedMarket;
    return sameDate && sameMarket;
  });
}

function findSnapshotsForDeletion(date, market) {
  return snapshotsForDeletion(state.cloudHistory.snapshots, date, market);
}

function snapshotDeletePreviewText(date, market) {
  const targets = findSnapshotsForDeletion(date, market);
  if (!date) return "請先選擇日期。";
  if (!targets.length) return "這個日期與市場沒有雲端快照。";
  const positionCount = targets.reduce((sum, snapshot) => (
    sum + snapshotPositionsFromList(snapshot.snapshotId, state.cloudHistory.positions).length
  ), 0);
  const marketSummary = [...new Set(targets.map((snapshot) => marketLabel(snapshot.market)))].join(" / ");
  return `將刪除 ${targets.length} 筆 ${marketSummary} 快照與 ${positionCount} 筆庫存明細。`;
}

function renderSnapshotDeleteOptions(selectedDate = "") {
  const dates = cloudSnapshotDates();
  if (!dates.length) {
    return "<p class=\"muted-text\">目前沒有可刪除的雲端快照。</p>";
  }
  const currentDate = normalizeDateText(selectedDate) || normalizeDateText(state.cloudSnapshot?.snapshot?.date) || dates[0];
  const currentMarket = normalizeMarketKey(state.cloudSnapshot?.snapshot?.market) || "TW";
  const dateOptions = dates.map((date) => (
    `<option value="${escapeHtml(date)}"${date === currentDate ? " selected" : ""}>${escapeHtml(date)}</option>`
  )).join("");
  return `
    <div class="snapshot-delete-form">
      <label>
        日期
        <select id="delete-snapshot-date">${dateOptions}</select>
      </label>
      <label>
        市場
        <select id="delete-snapshot-market">
          <option value="TW"${currentMarket === "TW" ? " selected" : ""}>台股</option>
          <option value="US"${currentMarket === "US" ? " selected" : ""}>美股</option>
          <option value="ALL">該日期全部市場</option>
        </select>
      </label>
      <button id="delete-cloud-snapshot" class="button ghost danger compact" type="button">刪除快照</button>
    </div>
    <p id="delete-snapshot-preview" class="snapshot-delete-preview">${escapeHtml(snapshotDeletePreviewText(currentDate, currentMarket))}</p>
  `;
}

function renderCloudSnapshotSwipeList() {
  const rows = [...(state.cloudHistory.snapshots || [])]
    .sort((a, b) => snapshotSortValue(b).localeCompare(snapshotSortValue(a)))
    .map(snapshotMetrics);
  if (!rows.length) return "<p class=\"muted-text\">目前沒有雲端快照。</p>";
  return `
    <div class="snapshot-swipe-list">
      ${rows.map((snapshot) => `
        <div class="swipe-row" data-snapshot-id="${escapeHtml(snapshot.snapshotId)}">
          <button class="swipe-delete-action" type="button" data-delete-snapshot-id="${escapeHtml(snapshot.snapshotId)}">刪除</button>
          <div class="swipe-row-content">
            <div>
              <strong>${escapeHtml(snapshot.date || "")}</strong>
              <span>${marketLabel(snapshot.market)} · ${formatNumber(snapshot.stockCount)} 檔 · ${formatMoney(snapshot.totalCost)}</span>
            </div>
            <small>${escapeHtml(snapshot.createdAt || "")}</small>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function dashboardTabButton(tab, label) {
  const selected = state.dashboardTab === tab;
  return `<button class="dashboard-tab${selected ? " is-active" : ""}" type="button" data-dashboard-tab="${tab}" aria-selected="${selected ? "true" : "false"}">${label}</button>`;
}

function snapshotToSheetRow(snapshot) {
  return [
    snapshot.snapshotId || "",
    snapshot.createdAt || "",
    snapshot.date || "",
    snapshot.market || "",
    snapshot.sourceEntryId || "",
    snapshot.sourceTitle || "",
    snapshot.rowCount ?? "",
    snapshot.appVersion || "",
  ];
}

function positionToSheetRow(row) {
  return [
    row.snapshotId || "",
    row.date || "",
    row.market || "",
    row.symbol || "",
    row.name || "",
    row.kind || "",
    row.shares ?? "",
    row.avgCost ?? "",
    row.source || "",
    row.createdAt || "",
  ];
}

function mergeSnapshotEntries(entries) {
  const candidates = entries
    .filter((entry) => entry.kind === "ark_position" && entry.status === "reviewed")
    .map((entry) => ({
      entry,
      rows: validSnapshotRows(entry.parsedRows || parseHoldings(entry.text || "")),
    }))
    .filter((item) => item.rows.length > 0);

  const bySymbol = new Map();
  const conflicts = [];
  for (const item of candidates) {
    for (const row of item.rows) {
      const symbol = String(row.symbol || "").trim();
      if (!symbol || /待補/.test(symbol)) continue;
      const existing = bySymbol.get(symbol);
      const normalized = { ...row, source: `${item.entry.title || item.entry.id}` };
      if (!existing) {
        bySymbol.set(symbol, normalized);
        continue;
      }
      const sameShares = Number(existing.shares) === Number(row.shares);
      const sameAvgCost = Number(existing.avgCost) === Number(row.avgCost);
      if (!sameShares || !sameAvgCost) {
        conflicts.push(`${symbol}：${existing.shares}/${existing.avgCost} vs ${row.shares}/${row.avgCost}`);
      }
    }
  }

  const rows = [...bySymbol.values()].sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)));
  return { candidates, rows, conflicts };
}

async function saveMergedSnapshotToGoogleSheet() {
  const { candidates, rows, conflicts } = mergeSnapshotEntries(state.entries);
  if (!candidates.length) {
    alert("目前沒有「已確認」狀態的方舟庫存截圖可合併。\n請先：① 重新解析截圖 → ② 標記已確認，再使用合併功能。");
    return;
  }
  if (!rows.length) {
    alert("已確認截圖中沒有可合併的庫存列。請先確認 OCR 解析結果與股票代號。");
    return;
  }
  if (conflicts.length) {
    alert(`合併快照發現同代號衝突，請打開截圖明細，在解析庫存表的修正欄調整股數或成交均價後再存：\n\n${conflicts.slice(0, 8).join("\n")}`);
    return;
  }

  const markets = [...new Set(candidates.map((item) => item.entry.market).filter(Boolean))];
  const marketGroups = splitRowsByMarket(rows, markets.length === 1 ? markets[0] : "");
  const confirmed = confirm(`將 ${candidates.length} 張方舟庫存截圖合併成 ${marketGroups.length} 個市場快照，共 ${rows.length} 筆庫存。若同日同市場已有快照，會先列出差異再詢問是否取代。確定繼續？`);
  if (!confirmed) return;

  const button = els.saveMergedSnapshot;
  if (button) {
    button.disabled = true;
    button.textContent = "合併寫入中...";
  }

  try {
    const createdAt = new Date().toISOString();
    const latestDate = candidates
      .map((item) => item.entry.date)
      .filter(Boolean)
      .sort()
      .at(-1) || today();
    const payloads = buildMarketSnapshotPayloadsFromRows({
      createdAt,
      date: latestDate,
      market: markets.length === 1 ? markets[0] : "",
      sourceEntryId: candidates.map((item) => item.entry.id).join(","),
      sourceTitle: `合併快照：${candidates.length} 張截圖`,
      rows,
    });

    await ensureCloudSheetTables();
    await loadLatestCloudSnapshot(false);
    const result = await writeMarketSnapshotPayloads(payloads);
    if (result.cancelled) return;
    const sheetSnapshotIds = [...result.written.map((payload) => payload.snapshotId), ...result.skipped.map((item) => item.existingSnapshot.snapshotId)];
    if (!result.written.length && result.skipped.length) {
      for (const item of candidates) {
        item.entry.status = "imported";
        item.entry.sheetSnapshotId = sheetSnapshotIds.join(",");
        item.entry.updatedAt = createdAt;
      }
      await txStore("readwrite", (store) => {
        candidates.forEach((item) => store.put(item.entry));
      });
      state.entries = await getAllEntries();
      render();
      alert("雲端已存在同日、同市場、同內容的快照，未重複寫入。");
      return;
    }

    for (const item of candidates) {
      item.entry.status = "imported";
      item.entry.sheetSnapshotId = sheetSnapshotIds.join(",");
      item.entry.updatedAt = createdAt;
    }
    await txStore("readwrite", (store) => {
      candidates.forEach((item) => store.put(item.entry));
    });
    state.entries = await getAllEntries();
    await loadLatestCloudSnapshot(false);
    render();
    alert(`已合併存到 Google Sheet：${rows.length} 筆庫存，${result.written.length} 個市場快照${result.replacedCount ? `，取代 ${result.replacedCount} 筆舊快照` : ""}`);
  } catch (error) {
    console.error(error);
    alert(error.message || "合併寫入 Google Sheet 失敗");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "合併存雲端";
    }
  }
}
async function saveEntrySnapshotToGoogleSheet(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  const payloads = buildMarketSnapshotPayloads(entry);
  const rowCount = payloads.reduce((sum, payload) => sum + payload.positionRows.length, 0);
  if (!rowCount) {
    alert("目前沒有可存入 Google Sheet 的庫存列。");
    return;
  }

  const button = els.detailContent.querySelector('[data-action="save-cloud-snapshot"]');
  if (button) {
    button.disabled = true;
    button.textContent = "寫入中...";
  }

  try {
    await ensureCloudSheetTables();
    await loadLatestCloudSnapshot(false);
    const result = await writeMarketSnapshotPayloads(payloads);
    if (result.cancelled) return;
    if (result.written.length) await saveLayoutDeltaToSheet(result.written);
    const sheetSnapshotIds = [...result.written.map((payload) => payload.snapshotId), ...result.skipped.map((item) => item.existingSnapshot.snapshotId)];
    if (!result.written.length && result.skipped.length) {
      entry.status = "imported";
      entry.sheetSnapshotId = sheetSnapshotIds.join(",");
      entry.updatedAt = new Date().toISOString();
      await txStore("readwrite", (store) => store.put(entry));
      state.entries = await getAllEntries();
      render();
      openDetail(id);
      alert("雲端已存在同日、同市場、同內容的快照，未重複寫入。");
      return;
    }
    entry.status = "imported";
    entry.sheetSnapshotId = sheetSnapshotIds.join(",");
    entry.updatedAt = new Date().toISOString();
    await txStore("readwrite", (store) => store.put(entry));
    await loadLatestCloudSnapshot(false);
    render();
    openDetail(id);
    alert(`已存到 Google Sheet：${rowCount} 筆庫存，${result.written.length} 個市場快照${result.replacedCount ? `，取代 ${result.replacedCount} 筆舊快照` : ""}`);
  } catch (error) {
    console.error(error);
    alert(error.message || "寫入 Google Sheet 失敗");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "存到 Google Sheet";
    }
  }
}

function parseSnapshotRows(values) {
  return (values || []).map((row) => ({
    snapshotId: row[0] || "",
    createdAt: row[1] || "",
    date: normalizeDateText(row[2] || ""),
    market: row[3] || "",
    sourceEntryId: row[4] || "",
    sourceTitle: row[5] || "",
    rowCount: Number(row[6] || 0),
    appVersion: row[7] || "",
  })).filter((row) => row.snapshotId);
}

function parsePositionRows(values) {
  return (values || []).map((row) => ({
    snapshotId: row[0] || "",
    date: normalizeDateText(row[1] || ""),
    market: String(row[2] || "").trim(),
    symbol: String(row[3] || "").trim(),
    name: String(row[4] || "").trim(),
    kind: String(row[5] || "").trim(),
    shares: Number(row[6] || 0),
    avgCost: Number(row[7] || 0),
    source: String(row[8] || "").trim(),
    createdAt: row[9] || "",
  })).filter((row) => row.snapshotId && row.symbol);
}

function parseLayoutRows(values) {
  return (values || []).map((row) => ({
    date: normalizeDateText(row[0] || ""),
    market: row[1] || "",
    symbol: row[2] || "",
    name: row[3] || "",
    shares: Number(row[4] || 0),
    prevShares: Number(row[5] || 0),
    delta: Number(row[6] || 0),
  })).filter((row) => row.date && row.symbol);
}

async function loadLatestCloudSnapshot(showAlert = true) {
  state.cloudLoading = true;
  renderCloudSnapshot();
  try {
    await ensureCloudSheetTables();
    const snapshotValues = await readCloudSheetValues(SHEET_NAMES.snapshots, "A2:H");
    const snapshots = parseSnapshotRows(stripHeaderRow(snapshotValues, SHEET_HEADERS.snapshots)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const positionValues = await readCloudSheetValues(SHEET_NAMES.positions, "A2:J");
    const positions = parsePositionRows(stripHeaderRow(positionValues, SHEET_HEADERS.positions));
    await Promise.all([
      loadTargetLevelHistory(),
      loadFirstBuyDatesFromSheet().catch(() => {}),
    ]);
    const layoutValues = await readCloudSheetValues(SHEET_NAMES.layout, "A2:G").catch(() => []);
    const layout = parseLayoutRows(stripHeaderRow(layoutValues, SHEET_HEADERS.layout));
    state.cloudHistory = { snapshots, positions, layout };
    if (!snapshots.length) {
      state.cloudSnapshot = null;
      state.cloudLoading = false;
      renderCloudSnapshot();
      if (showAlert) alert("Google Sheet 目前還沒有庫存快照。");
      return;
    }
    const latest = snapshots[0];
    const latestPositions = positions.filter((row) => row.snapshotId === latest.snapshotId);
    state.cloudSnapshot = { snapshot: latest, positions: latestPositions };
    state.cloudLoading = false;
    renderCloudSnapshot();
    renderSummaryLine();
    if (showAlert) alert(`已讀取雲端庫存：${latestPositions.length} 筆`);
    // 所有歷史快照的代號都要抓報價（趨勢圖需要用今日報價算各期損益率）
    const allSymbols = [...new Set([...positions.map((p) => p.symbol).filter(Boolean), "USDTWD=X"])];
    fetchQuotes(allSymbols);
  } catch (error) {
    console.error(error);
    state.cloudLoading = false;
    renderCloudSnapshot();
    if (showAlert) alert(error.message || "讀取 Google Sheet 失敗");
  }
}

function stripHeaderRow(values, headers) {
  if (!values?.length) return [];
  const first = values[0].map((value) => String(value || "").trim());
  const sameHeader = headers.every((header, index) => first[index] === header);
  return sameHeader ? values.slice(1) : values;
}

// 取當前 USD/TWD 匯率（從 state.quotes 已抓的報價取得）
function getUsdTwdRate() {
  const q = state.quotes["USDTWD=X"];
  const rate = typeof q === "number" ? q : (q?.price ?? null);
  return (rate && rate > 0) ? rate : 31.5; // fallback 31.5
}

async function fetchQuotes(symbols, retryCount = 0) {
  if (!symbols?.length || !googleAccessToken) return;
  // Proxy (Yahoo Finance batch) 有約 30 支上限，超過靜默丟棄 → 分批 25 支
  const BATCH_SIZE = 25;
  const formatted = symbols.map((s) => { const t = String(s || "").trim(); return /^\d/.test(t) ? `${t}.TW` : t; }).filter(Boolean);
  const batches = [];
  for (let i = 0; i < formatted.length; i += BATCH_SIZE) batches.push(formatted.slice(i, i + BATCH_SIZE));
  try {
    let anySuccess = false;
    for (const batch of batches) {
      const symbolList = batch.join(",");
      const res = await fetch(`${QUOTE_PROXY_URL}?symbols=${encodeURIComponent(symbolList)}`);
      const data = await res.json();
      if (data?.quotes) {
        for (const [k, v] of Object.entries(data.quotes)) {
          state.quotes[k.replace(/\.TW$/i, "")] = v;
        }
        anySuccess = true;
      }
    }
    if (anySuccess) renderCloudSnapshot();
    else if (retryCount < 2) setTimeout(() => fetchQuotes(symbols, retryCount + 1), 3000);
  } catch (err) {
    console.warn("fetchQuotes", err);
    if (retryCount < 2) setTimeout(() => fetchQuotes(symbols, retryCount + 1), 3000);
  }
}

function estimatedCost(row) {
  const shares = Number(row?.shares || 0);
  const avgCost = Number(row?.avgCost || 0);
  return Number.isFinite(shares * avgCost) ? shares * avgCost : 0;
}

function formatNumber(value, digits = 0) {
  const number = Number(value || 0);
  return number.toLocaleString("zh-Hant-TW", {
    maximumFractionDigits: digits,
  });
}

function formatMoney(value) {
  return formatNumber(value, 0);
}

function formatSignedMoney(value) {
  const number = Number(value || 0);
  const sign = number > 0 ? "+" : "";
  return `${sign}${formatMoney(number)}`;
}

function formatSignedNumber(value, digits = 3) {
  const number = Number(value || 0);
  const sign = number > 0 ? "+" : "";
  return `${sign}${formatNumber(number, digits)}`;
}

function formatPercent(value) {
  const number = Number(value || 0);
  return `${number.toFixed(1)}%`;
}

function formatSignedPercent(value) {
  const number = Number(value || 0);
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(1)}%`;
}

function snapshotPositions(snapshotId) {
  return (state.cloudHistory.positions || []).filter((row) => row.snapshotId === snapshotId);
}

function snapshotMetrics(snapshot) {
  const positions = snapshotPositions(snapshot.snapshotId);
  const totalShares = positions.reduce((sum, row) => sum + Number(row.shares || 0), 0);
  const totalCost = positions.reduce((sum, row) => sum + estimatedCost(row), 0);
  return {
    ...snapshot,
    positions,
    stockCount: positions.length,
    totalShares,
    totalCost,
  };
}

function snapshotSortValue(snapshot) {
  return `${snapshot.date || ""} ${snapshot.createdAt || ""} ${snapshot.snapshotId || ""}`;
}

function rowsBySymbol(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!row.symbol) continue;
    map.set(row.symbol, row);
  }
  return map;
}

function buildLayoutAnalysis() {
  const orderedSnapshots = [...(state.cloudHistory.snapshots || [])]
    .sort((a, b) => snapshotSortValue(a).localeCompare(snapshotSortValue(b)));
  const previousByMarket = { TW: null, US: null };
  const points = [];

  for (const snapshot of orderedSnapshots) {
    const snapshotRows = snapshotPositionsFromList(snapshot.snapshotId, state.cloudHistory.positions)
      .map((row) => ({
        ...row,
        marketKey: marketForPosition(row),
        cost: estimatedCost(row),
      }));

    for (const market of ["TW", "US"]) {
      const rows = snapshotRows.filter((row) => row.marketKey === market);
      const currentMap = rowsBySymbol(rows);
      const previousMap = previousByMarket[market];
      if (!rows.length && !previousMap) continue;

      const deltas = [];
      if (previousMap) {
        const symbols = new Set([...previousMap.keys(), ...currentMap.keys()]);
        for (const symbol of symbols) {
          const current = currentMap.get(symbol);
          const previous = previousMap.get(symbol);
          const currentShares = Number(current?.shares || 0);
          const previousShares = Number(previous?.shares || 0);
          const deltaShares = currentShares - previousShares;
          if (Math.abs(deltaShares) < 0.000001) continue;
          const avgCost = Number(current?.avgCost || previous?.avgCost || 0);
          deltas.push({
            symbol,
            name: current?.name || previous?.name || "",
            shares: currentShares,
            previousShares,
            deltaShares,
            avgCost,
            layoutCost: deltaShares * avgCost,
          });
        }
      }

      const buyCost = deltas.filter((row) => row.layoutCost > 0).reduce((sum, row) => sum + row.layoutCost, 0);
      const sellCost = Math.abs(deltas.filter((row) => row.layoutCost < 0).reduce((sum, row) => sum + row.layoutCost, 0));
      points.push({
        snapshot,
        market,
        date: snapshot.date || snapshot.createdAt?.slice(0, 10) || "",
        isInitial: !previousMap,
        rows,
        stockCount: rows.length,
        totalShares: rows.reduce((sum, row) => sum + Number(row.shares || 0), 0),
        totalCost: rows.reduce((sum, row) => sum + row.cost, 0),
        targetLevel: targetLevelForMarket(market, snapshot.date),
        deltas: deltas.sort((a, b) => Math.abs(b.layoutCost) - Math.abs(a.layoutCost)),
        buyCost,
        sellCost,
        netLayoutCost: buyCost - sellCost,
      });
      previousByMarket[market] = currentMap;
    }
  }

  return points;
}

function renderWaterCostAnalysis(points) {
  if (!points.length) return "<p class=\"muted-text\">尚無足夠快照建立布局分析。</p>";
  return ["TW", "US"].map((market) => {
    const marketPoints = points.filter((item) => item.market === market).slice(-12);
    if (!marketPoints.length) return "";
    const maxAbsCost = Math.max(...marketPoints.map((item) => Math.abs(item.netLayoutCost)), 0);
    const rows = marketPoints.map((item) => {
      const barClass = item.netLayoutCost >= 0 ? "buy" : "sell";
      return `
        <div class="water-cost-row">
          <div>
            <strong>${escapeHtml(item.date)}</strong>
            <span>${item.isInitial ? "初始庫存" : `${item.deltas.length} 檔變動`}</span>
          </div>
          <span>${item.targetLevel === null ? "水位未設定" : formatPercent(item.targetLevel)}</span>
          <div class="layout-cost-meter ${barClass}">
            <span style="width: ${widthPercent(Math.abs(item.netLayoutCost), maxAbsCost)}%"></span>
          </div>
          <b>${item.isInitial ? "基準" : formatSignedMoney(item.netLayoutCost)}</b>
        </div>
      `;
    }).join("");
    return `<h4 class="market-section-heading">${marketLabel(market)}</h4>${rows}`;
  }).join("");
}

function renderDailyShareMatrix(points) {
  if (!points.length) return "<p class=\"muted-text\">尚無個股股數時間序列。</p>";
  return ["TW", "US"].map((market) => {
    const recent = points.filter((item) => item.market === market).slice(-8);
    if (!recent.length) return "";
    const symbols = new Map();
    for (const point of recent) {
      for (const row of point.rows) {
        const item = symbols.get(row.symbol) || {
          symbol: row.symbol,
          name: row.name || "",
          score: 0,
        };
        item.score = Math.max(item.score, estimatedCost(row));
        symbols.set(row.symbol, item);
      }
    }
    const selected = [...symbols.values()].sort((a, b) => b.score - a.score).slice(0, 16);
    const maxShares = Math.max(...recent.flatMap((point) => point.rows.map((row) => Number(row.shares || 0))), 0);
    const head = recent.map((point) => `<th>${escapeHtml(point.date.slice(5) || point.date)}</th>`).join("");
    const body = selected.map((symbol) => {
      const cells = recent.map((point) => {
        const row = point.rows.find((item) => item.symbol === symbol.symbol);
        const shares = Number(row?.shares || 0);
        return `
          <td>
            <div class="share-cell">
              <span style="width: ${widthPercent(shares, maxShares)}%"></span>
              <b>${shares ? formatNumber(shares, 3) : "-"}</b>
            </div>
          </td>
        `;
      }).join("");
      return `
        <tr>
          <th>${escapeHtml(symbol.symbol)}<br><small>${escapeHtml(symbol.name)}</small></th>
          ${cells}
        </tr>
      `;
    }).join("");
    return `
      <h4 class="market-section-heading">${marketLabel(market)}</h4>
      <div class="table-scroll share-matrix">
        <table>
          <thead><tr><th>個股</th>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }).join("");
}

// ── 共用：市場切換按鈕（台股 / 美股 / 全部），控制 state.levelChartMarket ──────
function renderMarketBtns() {
  const mkt = state.levelChartMarket || "TW";
  return [["TW", "台股"], ["US", "美股"], ["ALL", "全部"]].map(([m, label]) =>
    `<button class="level-range-btn${m === mkt ? " is-active" : ""}" type="button" data-level-market="${m}">${label}</button>`
  ).join("");
}

function renderTargetLevelChart(history) {
  const rangeKey = state.levelChartRange || "1M";
  const marketKey = state.levelChartMarket || "TW";
  const rangeDays = { "1M": 31, "6M": 183, "1Y": 365 };
  const days = rangeDays[rangeKey] || 31;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const filtered = history.filter((item) => item.date >= cutoff && (marketKey === "ALL" || item.market === marketKey));
  const allDates = [...new Set(filtered.map((item) => item.date))].sort();
  if (!allDates.length) return "<p class=\"muted-text\">尚無歷史水位資料。</p>";
  const markets = marketKey === "ALL" ? ["TW", "US"] : [marketKey];
  const colors = { TW: "var(--green)", US: "#4f8ef7" };
  const allVals = filtered.map((i) => i.targetLevel);
  const minVal = Math.max(0, Math.floor(Math.min(...allVals) / 10) * 10 - 5);
  const maxVal = Math.min(100, Math.ceil(Math.max(...allVals) / 10) * 10 + 5);
  const valRange = maxVal - minVal || 10;
  const W = 600; const H = 170;
  const PL = 34; const PR = 8; const PT = 8; const PB = 26;
  const cW = W - PL - PR; const cH = H - PT - PB;
  const xPos = (i) => PL + (i / (allDates.length - 1 || 1)) * cW;
  const yPos = (v) => PT + (1 - (v - minVal) / valRange) * cH;
  const yLines = [];
  for (let v = Math.ceil(minVal / 5) * 5; v <= maxVal; v += 5) {
    const y = yPos(v);
    yLines.push(`<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="var(--line)" stroke-width="${v % 10 === 0 ? 0.8 : 0.3}"/>`);
    if (v % 10 === 0) yLines.push(`<text x="${PL - 4}" y="${y + 4}" text-anchor="end" font-size="9" fill="var(--muted)">${v}%</text>`);
  }
  const maxLabels = Math.min(allDates.length, rangeKey === "1Y" ? 12 : rangeKey === "6M" ? 6 : 4);
  const labelStep = Math.max(1, Math.floor(allDates.length / maxLabels));
  const xLabels = allDates.map((d, i) => {
    if (i % labelStep !== 0 && i !== allDates.length - 1) return "";
    const label = rangeKey === "1Y" ? d.slice(0, 7) : d.slice(5);
    return `<text x="${xPos(i)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="var(--muted)">${label}</text>`;
  }).join("");
  const lines = markets.map((market) => {
    const pts = allDates.map((d, i) => {
      const found = filtered.find((item) => item.market === market && item.date === d);
      return found ? { i, v: found.targetLevel } : null;
    });
    // break line into segments at null gaps (no data = no line)
    const segments = [];
    let seg = [];
    for (const pt of pts) {
      if (pt) { seg.push(pt); }
      else if (seg.length) { segments.push(seg); seg = []; }
    }
    if (seg.length) segments.push(seg);
    if (!segments.length) return "";
    const polylines = segments.map((s) =>
      `<polyline points="${s.map((p) => `${xPos(p.i)},${yPos(p.v)}`).join(" ")}" fill="none" stroke="${colors[market]}" stroke-width="2" stroke-linejoin="round"/>`
    ).join("");
    const dots = pts.filter(Boolean).map((p) => `<circle cx="${xPos(p.i)}" cy="${yPos(p.v)}" r="2.5" fill="${colors[market]}" data-tooltip="${marketLabel(market)} ${allDates[p.i]} ${p.v}%"><title>${marketLabel(market)} ${allDates[p.i]} ${p.v}%</title></circle>`).join("");
    return polylines + dots;
  }).join("");
  const legend = markets.map((m) => `<span class="level-legend-dot" style="background:${colors[m]}"></span>${marketLabel(m)}`).join(" ");
  const rangeBtns = ["1M", "6M", "1Y"].map((r) =>
    `<button class="level-range-btn${r === rangeKey ? " is-active" : ""}" type="button" data-level-range="${r}">${r}</button>`
  ).join("");
  const marketBtns = renderMarketBtns();
  return `
    <div class="level-chart-wrap">
      <div class="level-chart-topbar">
        <div class="level-range-btns">${marketBtns}</div>
        <div class="level-range-btns">${rangeBtns}</div>
      </div>
      <div class="level-chart-container" style="position:relative">
        <svg viewBox="0 0 ${W} ${H}" class="level-chart-svg" aria-label="建議水位趨勢">
          ${yLines.join("")}
          ${xLabels}
          ${lines}
        </svg>
      </div>
    </div>
  `;
}

function renderLayoutDeltaTable(points) {
  if (!points.length) return "<p class=\"muted-text\">目前還沒有快照差異可計算。</p>";
  return ["TW", "US"].map((market) => {
    const rows = points
      .slice()
      .reverse()
      .filter((point) => point.market === market)
      .flatMap((point) => point.deltas.map((delta) => ({
        ...delta,
        date: point.date,
        market: point.market,
      })))
      .slice(0, 40);
    if (!rows.length) return "";
    return `
      <h4 class="market-section-heading">${marketLabel(market)}</h4>
      <div class="table-scroll compact-table">
        <table class="parsed-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>代號</th>
              <th>名稱</th>
              <th>布局股數</th>
              <th>估算成本</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(row.symbol)}</td>
                <td>${escapeHtml(row.name)}</td>
                <td>${formatSignedNumber(row.deltaShares, 3)}</td>
                <td>${formatSignedMoney(row.layoutCost)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }).join("");
}

function buildSharesTimeline(cloudHistory) {
  const snapshots = (cloudHistory?.snapshots || [])
    .slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const allPositions = cloudHistory?.positions || [];
  const dates = [...new Set(snapshots.map((s) => s.date || s.createdAt?.slice(0, 10) || ""))].sort();
  return { snapshots, allPositions, dates };
}

function renderSharesSvg(series, dates, colors, W = 600, H = 140) {
  if (!dates.length) return "<p class=\"muted-text\">需要至少兩筆快照才能顯示趨勢。</p>";
  const PL = 52; const PR = 8; const PT = 8; const PB = 24;
  const cW = W - PL - PR; const cH = H - PT - PB;
  const allVals = series.flatMap((s) => s.pts.map((p) => p.v));
  if (!allVals.length) return "<p class=\"muted-text\">尚無資料。</p>";
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const range = rawMax - rawMin || 1;
  const minV = rawMin > 0 ? Math.max(0, rawMin - range * 0.2) : Math.min(0, rawMin);
  const maxV = Math.ceil((rawMax + range * 0.1) * 1.1) || 1;
  const xPos = (i) => PL + (i / (dates.length - 1 || 1)) * cW;
  const yPos = (v) => PT + (1 - (v - minV) / (maxV - minV || 1)) * cH;
  const labelStep = Math.max(1, Math.floor(dates.length / 5));
  const xLabels = dates.map((d, i) => {
    if (i % labelStep !== 0 && i !== dates.length - 1) return "";
    const anchor = i === dates.length - 1 ? "end" : "middle";
    return `<text x="${xPos(i)}" y="${H - 4}" text-anchor="${anchor}" font-size="9" fill="var(--muted)">${d.slice(5)}</text>`;
  }).join("");
  const yStep = maxV > 5000 ? 1000 : maxV > 1000 ? 500 : maxV > 200 ? 100 : maxV > 50 ? 20 : 10;
  const yLines = [];
  for (let v = yStep; v <= maxV; v += yStep) {
    const y = yPos(v);
    yLines.push(`<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="var(--line)" stroke-width="0.5"/>`);
    yLines.push(`<text x="${PL - 4}" y="${y + 4}" text-anchor="end" font-size="9" fill="var(--muted)">${v >= 1000 ? `${v / 1000}k` : v}</text>`);
  }
  if (minV < 0) {
    const y0 = yPos(0);
    yLines.push(`<line x1="${PL}" y1="${y0}" x2="${W - PR}" y2="${y0}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3,3"/>`);
  }
  const svgLines = series.map(({ pts, color }) => {
    if (!pts.length) return "";
    const segs = []; let seg = [];
    const indexed = dates.map((_, i) => pts.find((p) => p.i === i) || null);
    for (const pt of indexed) {
      if (pt) { seg.push(pt); } else if (seg.length) { segs.push(seg); seg = []; }
    }
    if (seg.length) segs.push(seg);
    const polylines = segs.map((s) =>
      `<polyline points="${s.map((p) => `${xPos(p.i)},${yPos(p.v)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`
    ).join("");
    const dots = pts.map((p) => `<circle cx="${xPos(p.i)}" cy="${yPos(p.v)}" r="2.5" fill="${color}" data-tooltip="${dates[p.i]} ${p.v.toLocaleString()}"><title>${dates[p.i]} ${p.v.toLocaleString()}</title></circle>`).join("");
    return polylines + dots;
  }).join("");
  return `<div class="shares-chart-container" style="position:relative"><svg viewBox="0 0 ${W} ${H}" class="level-chart-svg">${yLines.join("")}${xLabels}${svgLines}</svg></div>`;
}

function renderSnapshotTrendChart(cloudHistory, quotes, marketKey) {
  marketKey = marketKey || state.levelChartMarket || "TW";
  const rangeKey = state.plTrendRange || "1M";
  const rangeDays = { "1M": 31, "3M": 92, "ALL": 9999 };
  const cutoff = new Date(Date.now() - (rangeDays[rangeKey] || 31) * 86400000).toISOString().slice(0, 10);
  const allSnapshots = (cloudHistory?.snapshots || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const snapshots = allSnapshots.filter((s) => (s.date || s.createdAt?.slice(0, 10) || "") >= cutoff);
  const positions = cloudHistory?.positions || [];
  if (snapshots.length < 2) return "<p class=\"muted-text\">需要至少兩筆快照才能顯示趨勢。</p>";
  const dates = [...new Set(snapshots.map((s) => s.date || s.createdAt?.slice(0, 10) || ""))].sort();
  const colors = { TW: "var(--green)", US: "#4f8ef7" };
  const activeMarkets = marketKey === "ALL" ? ["TW", "US"] : [marketKey];
  const series = activeMarkets.map((market) => {
    const pts = dates.map((d) => {
      // 同日多個快照取最新
      const snapsForDate = snapshots.filter((s) => (s.date || s.createdAt?.slice(0, 10)) === d && normalizeMarketKey(s.market) === market);
      const snap = snapsForDate[snapsForDate.length - 1];
      if (!snap) return null;
      const mktPos = positions.filter((p) => p.snapshotId === snap.snapshotId && Number(p.avgCost) > 0);
      if (!mktPos.length) return null;
      let totalPL = 0; let hasQuote = false;
      for (const p of mktPos) {
        const q = quotes?.[p.symbol];
        const price = typeof q === "number" ? q : (q?.price ?? null);
        if (price === null || price <= 0) continue;
        const shares = Number(p.shares || 0);
        const avgCost = Number(p.avgCost || 0);
        if (avgCost <= 0 || shares <= 0) continue;
        totalPL += (price - avgCost) * shares;
        hasQuote = true;
      }
      if (market === "US") totalPL *= getUsdTwdRate(); // USD → TWD
      return hasQuote ? { d, v: Math.round(totalPL) } : null;
    }).filter(Boolean);
    return { market, pts, color: colors[market] };
  });
  if (!series.some((s) => s.pts.length > 0)) return "<p class=\"muted-text\">尚無報價資料可計算損益。</p>";
  const legend = activeMarkets.map((m) => `<span class="level-legend-dot" style="background:${colors[m]}"></span>${marketLabel(m)}`).join(" ");
  const rangeBtns = ["1M", "3M", "ALL"].map((r) =>
    `<button class="level-range-btn${r === rangeKey ? " is-active" : ""}" type="button" data-pl-trend-range="${r}">${r}</button>`
  ).join("");
  return `<div class="level-chart-topbar" style="margin-bottom:6px"><div class="level-range-btns">${renderMarketBtns()}</div><div class="level-chart-legend">${legend}</div><div class="level-range-btns">${rangeBtns}</div></div>${renderTimedSvg(series, dates)}`;
}

// 時間比例 x 軸 SVG — x 位置依實際日期比例計算，避免多日期等距擠壓
function renderTimedSvg(series, dates, W = 600, H = 140) {
  if (!dates.length) return "<p class=\"muted-text\">尚無資料。</p>";
  const PL = 52; const PR = 8; const PT = 8; const PB = 24;
  const cW = W - PL - PR; const cH = H - PT - PB;
  const minMs = new Date(dates[0]).getTime();
  const maxMs = new Date(dates[dates.length - 1]).getTime();
  const msRange = maxMs - minMs || 1;
  const xPos = (d) => PL + ((new Date(d).getTime() - minMs) / msRange) * cW;
  const allVals = series.flatMap((s) => s.pts.map((p) => p.v));
  if (!allVals.length) return "<p class=\"muted-text\">尚無資料。</p>";
  const rawMin = Math.min(...allVals); const rawMax = Math.max(...allVals);
  const vRange = rawMax - rawMin || 1;
  const minV = rawMin >= 0 ? Math.max(0, rawMin - vRange * 0.2) : rawMin - vRange * 0.1;
  const maxV = rawMax + vRange * 0.1;
  const yPos = (v) => PT + (1 - (v - minV) / (maxV - minV || 1)) * cH;
  // Y 軸格線：nice-step，目標 5 條
  const _yRange = (maxV - minV) || 1;
  const _rawYStep = _yRange / 5;
  const _yMag = Math.pow(10, Math.floor(Math.log10(Math.abs(_rawYStep) || 1)));
  const _yNorm = _rawYStep / _yMag;
  const yStep = (_yNorm < 1.5 ? 1 : _yNorm < 3.5 ? 2 : _yNorm < 7.5 ? 5 : 10) * _yMag;
  const yLines = [];
  for (let v = Math.floor(minV / yStep) * yStep; v <= maxV + yStep; v += yStep) {
    const y = yPos(v); if (y < PT - 2 || y > H - PB + 2) continue;
    yLines.push(`<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="var(--line)" stroke-width="0.5"/>`);
    const lbl = Math.abs(v) >= 10000 ? `${Math.round(v / 1000)}k` : v;
    yLines.push(`<text x="${PL - 4}" y="${y + 4}" text-anchor="end" font-size="9" fill="var(--muted)">${lbl}</text>`);
  }
  if (minV < 0) {
    const y0 = yPos(0); if (y0 >= PT && y0 <= H - PB)
      yLines.push(`<line x1="${PL}" y1="${y0}" x2="${W - PR}" y2="${y0}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3,3"/>`);
  }
  // X 軸標籤：最多 6 個，均勻取樣
  const maxLabels = 6;
  const labelStep = Math.max(1, Math.floor(dates.length / maxLabels));
  const xLabels = dates.map((d, i) => {
    if (i % labelStep !== 0 && i !== dates.length - 1) return "";
    const anchor = i === dates.length - 1 ? "end" : "middle";
    return `<text x="${xPos(d)}" y="${H - 4}" text-anchor="${anchor}" font-size="9" fill="var(--muted)">${d.slice(5)}</text>`;
  }).join("");
  // 折線與圓點
  const svgLines = series.map(({ pts, color }) => {
    if (!pts.length) return "";
    const sorted = [...pts].sort((a, b) => a.d.localeCompare(b.d));
    const polyline = `<polyline points="${sorted.map((p) => `${xPos(p.d)},${yPos(p.v)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
    const dots = sorted.map((p) => `<circle cx="${xPos(p.d)}" cy="${yPos(p.v)}" r="2.5" fill="${color}" data-tooltip="${p.d} ${p.v.toLocaleString()}"><title>${p.d} ${p.v.toLocaleString()}</title></circle>`).join("");
    return polyline + dots;
  }).join("");
  return `<div class="shares-chart-container" style="position:relative"><svg viewBox="0 0 ${W} ${H}" class="level-chart-svg">${yLines.join("")}${xLabels}${svgLines}</svg></div>`;
}

function renderPerfRateTrendChart(cloudHistory, quotes, marketKey) {
  marketKey = marketKey || state.levelChartMarket || "TW";
  const snapshots = (cloudHistory?.snapshots || []).slice().sort((a, b) => String(a.date || a.createdAt).localeCompare(String(b.date || b.createdAt)));
  const positions = cloudHistory?.positions || [];
  if (snapshots.length < 2) return "<p class=\"muted-text\">需要至少兩筆快照才能顯示趨勢。</p>";
  const dates = [...new Set(snapshots.map((s) => s.date || s.createdAt?.slice(0, 10) || ""))].sort();
  const colors = { TW: "var(--green)", US: "#4f8ef7" };
  const activeMarkets = marketKey === "ALL" ? ["TW", "US"] : [marketKey];
  const series = activeMarkets.map((market) => {
    const pts = dates.map((d, i) => {
      // 同一天可能有多個快照（舊的錯的 + 新的修正的）→ 取最新那個（sort ascending，所以取最後一個）
      const snapsForDate = snapshots.filter((s) => (s.date || s.createdAt?.slice(0, 10)) === d && normalizeMarketKey(s.market) === market);
      const snap = snapsForDate[snapsForDate.length - 1];
      if (!snap) return null;
      const mktPos = positions.filter((p) => p.snapshotId === snap.snapshotId && Number(p.avgCost) > 0);
      if (!mktPos.length) return null;
      const rates = mktPos.map((p) => {
        const q = quotes[p.symbol];
        const price = typeof q === "number" ? q : (q?.price ?? null);
        if (price === null || price <= 0) return null;
        const rate = (price - Number(p.avgCost)) / Number(p.avgCost) * 100;
        // 異常值過濾：均價錯誤（如 OCR 誤讀）會產生數千%，排除
        if (!Number.isFinite(rate) || Math.abs(rate) > 500) return null;
        return rate;
      }).filter((r) => r !== null);
      if (!rates.length) return null;
      const avg = rates.reduce((s, v) => s + v, 0) / rates.length;
      return { i, v: Math.round(avg * 10) / 10 };
    }).filter(Boolean);
    return { market, pts, color: colors[market] };
  });
  if (!series.some((s) => s.pts.length > 0)) return "<p class=\"muted-text\">尚無報價資料可計算趨勢。</p>";
  const legend = activeMarkets.map((m) => `<span class="level-legend-dot" style="background:${colors[m]}"></span>${marketLabel(m)}`).join(" ");
  return `<div class="level-chart-topbar" style="margin-bottom:6px"><div class="level-range-btns">${renderMarketBtns()}</div><div class="level-chart-legend">${legend}</div><div></div></div>${renderSharesSvg(series, dates, colors)}`;
}

// ── 個股損益貢獻橫向 bar chart ──────────────────────────────────────────────
function renderPLContributionChart(positions, quotes) {
  const items = positions.map((p) => {
    const q = quotes[p.symbol];
    const price = typeof q === "number" ? q : (q?.price ?? null);
    if (price === null || price <= 0 || !(p.avgCost > 0)) return null;
    const plUsd = (price - p.avgCost) * Number(p.shares || 0);
    const pl = marketForPosition(p) === "US" ? plUsd * getUsdTwdRate() : plUsd;
    return { symbol: p.symbol, name: p.name || p.symbol, pl };
  }).filter(Boolean).sort((a, b) => b.pl - a.pl);
  if (!items.length) return "<p class=\"muted-text\">尚無報價資料。</p>";
  // 取前 8 獲利 + 後 5 虧損（若有）
  const gainers = items.filter((i) => i.pl >= 0).slice(0, 8);
  const losers = items.filter((i) => i.pl < 0).slice(-5).reverse();
  const shown = [...gainers, ...losers];
  const maxAbs = Math.max(...shown.map((i) => Math.abs(i.pl)), 1);
  const rows = shown.map((item) => {
    const pct = (Math.abs(item.pl) / maxAbs * 100).toFixed(1);
    const color = item.pl >= 0 ? "var(--green)" : "var(--red)";
    const lbl = item.pl >= 0 ? `+${Math.round(item.pl).toLocaleString()}` : `${Math.round(item.pl).toLocaleString()}`;
    return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
      <span style="min-width:52px;font-size:12px;font-weight:600;text-align:right">${escapeHtml(item.symbol)}</span>
      <div style="flex:1;background:var(--card-bg);border-radius:3px;height:14px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;opacity:0.85"></div>
      </div>
      <span style="min-width:80px;font-size:11px;color:${color};text-align:right">${lbl}</span>
    </div>`;
  }).join("");
  return `<div style="padding:4px 0">${rows}</div>`;
}

// ── 共用：散點圖 SVG 渲染（支援 Y 軸上限裁切 + X 軸天數窗口）──────────────
function buildScatterSvg({ items, getX, getY, getColor, getTip, capKey, capOptions, unitLabel, maxX, dayCapKey = null, dayCapOptions = [], refLineKey = null, W = 600, H = 200, PL = 44, PR = 20, PT = 16, PB = 30 }) {
  const cW = W - PL - PR, cH = H - PT - PB;
  const dayCap = dayCapKey ? state[dayCapKey] : null;
  const visItems = dayCap !== null ? items.filter(i => getX(i) <= dayCap) : items;
  const effMaxX = dayCap !== null ? dayCap : maxX;
  const cap = state[capKey];  // null = 全部顯示
  const allVals = visItems.map(getY);
  const rawMin = Math.min(...allVals, 0), rawMax = Math.max(...allVals, 0);
  const effMax = cap !== null ? cap : rawMax;
  const vPad = (effMax - rawMin || 10) * 0.18;
  const minV = rawMin - vPad, maxV = effMax + vPad;
  const xP = (v) => PL + (v / (effMaxX || 1)) * cW;
  const yP = (v) => PT + (1 - (v - minV) / (maxV - minV || 1)) * cH;
  const y0 = yP(0);
  // Y 格線：動態 nice step，目標約 6 條格線，適用任意數值範圍
  const vRange = (maxV - minV) || 1;
  const rawStep = vRange / 6;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const yStep = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  const yLines = [];
  for (let v = Math.ceil(minV / yStep) * yStep; v <= maxV + yStep * 0.1; v += yStep) {
    const y = yP(v); if (y < PT - 2 || y > H - PB + 2) continue;
    yLines.push(`<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="var(--line)" stroke-width="0.4"/>`);
    const lbl = Math.abs(v) >= 10000 ? `${(v/1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `${v>=0&&v!==0?'+':''}${v}${unitLabel}`;
    yLines.push(`<text x="${PL-3}" y="${y+4}" text-anchor="end" font-size="9" fill="var(--muted)">${lbl}</text>`);
  }
  const zeroLine = y0 >= PT && y0 <= H - PB
    ? `<line x1="${PL}" y1="${y0}" x2="${W-PR}" y2="${y0}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4,3"/>` : "";
  const xLabels = [0, Math.round(effMaxX/2), effMaxX].map((d) =>
    `<text x="${xP(d)}" y="${H-4}" text-anchor="middle" font-size="9" fill="var(--muted)">${d}天</text>`).join("");
  // 裁切指示線
  const clipLine = cap !== null
    ? `<line x1="${PL}" y1="${PT}" x2="${W-PR}" y2="${PT}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="5,3" opacity="0.6"/>`
    : "";
  // 碰撞迴避
  const CHAR_W = 5.5, LABEL_H = 11, LABEL_PAD_X = 3, LABEL_PAD_Y = 2;
  const placed = [];
  const withLabel = [...visItems]
    .sort((a, b) => xP(getX(a)) - xP(getX(b)))
    .map((item) => {
      const cx = xP(getX(item));
      const rawDotY = yP(getY(item));
      const clipped = cap !== null && getY(item) > cap;
      const dotY = clipped ? PT + 4 : rawDotY;
      const hw = (item.symbol.length * CHAR_W) / 2;
      let ly = clipped ? PT - 6 : dotY - 7;
      for (let t = 0; t < 10; t++) {
        const clash = placed.some(
          (p) => Math.abs(p.cx - cx) < hw + p.hw + LABEL_PAD_X && Math.abs(p.cy - ly) < LABEL_H + LABEL_PAD_Y
        );
        if (!clash) break;
        ly -= (LABEL_H + LABEL_PAD_Y);
      }
      placed.push({ cx, cy: ly, hw });
      return { ...item, cx, dotY, ly, clipped };
    });
  const dots = withLabel.map((item) => {
    const color = getColor(item);
    const tip = getTip(item);
    const lineY1 = item.ly + 2, lineY2 = item.dotY - 5.5;
    const leaderLine = !item.clipped && lineY2 - lineY1 > 4
      ? `<line x1="${item.cx}" y1="${lineY1}" x2="${item.cx}" y2="${lineY2}" stroke="var(--muted)" stroke-width="0.8" opacity="0.5" stroke-dasharray="2,2"/>` : "";
    const shape = item.clipped
      ? `<polygon points="${item.cx},${PT+1} ${item.cx-4.5},${PT+9} ${item.cx+4.5},${PT+9}" fill="${color}" opacity="0.9" data-tooltip="${tip}"><title>${tip}</title></polygon>`
      : `<circle cx="${item.cx}" cy="${item.dotY}" r="4.5" fill="${color}" opacity="0.85" data-tooltip="${tip}"><title>${tip}</title></circle>`;
    const textEl = `<text x="${item.cx}" y="${item.ly}" text-anchor="middle" font-size="8" fill="var(--text)" font-weight="600" paint-order="stroke" stroke="var(--bg)" stroke-width="2.5">${escapeHtml(item.symbol)}</text>`;
    if (refLineKey && !item.clipped && getX(item) > 0) {
      const slope = getY(item) / getX(item);
      const gAttrs = `data-scatter-ref data-ref-key="${refLineKey}" data-ref-symbol="${escapeHtml(item.symbol)}"` +
        ` data-ref-x1="${xP(0).toFixed(1)}" data-ref-y1="${yP(0).toFixed(1)}"` +
        ` data-ref-x2="${xP(effMaxX).toFixed(1)}" data-ref-y2="${yP(slope * effMaxX).toFixed(1)}"` +
        ` data-ref-slope="${slope.toFixed(6)}" data-ref-dot-x="${getX(item)}" data-ref-dot-y="${getY(item).toFixed(2)}"` +
        ` data-ref-orig-color="${color}" data-ref-pt="${PT}" data-ref-hpb="${H - PB}" style="cursor:pointer"`;
      return `<g ${gAttrs}>${leaderLine}${shape}${textEl}</g>`;
    }
    return `${leaderLine}${shape}${textEl}`;
  }).join("");
  // Y 軸滑軸（連續，取代離散按鈕）
  const yCapCur = cap !== null ? cap : rawMax;
  const yCapMax = Math.max(1, Math.ceil(rawMax));
  const yCapStep = yCapMax > 10000 ? Math.max(100, Math.round(yCapMax / 100)) : yCapMax > 100 ? 1 : 0.5;
  const yCapLbl = yCapCur >= yCapMax ? "全部" : (Math.abs(yCapCur) >= 10000 ? `${(yCapCur/1000).toFixed(0)}k` : `${Number(yCapCur.toFixed(1))}${unitLabel}`);
  const ySlider = `<label class="scatter-slider-row">
    <span class="scatter-slider-label">Y ≤ <strong class="scatter-y-lbl" data-cap-key="${capKey}" data-cap-max="${yCapMax}" data-cap-unit="${unitLabel}">${yCapLbl}</strong></span>
    <input type="range" class="scatter-y-slider level-chart-slider"
           min="0" max="${yCapMax}" step="${yCapStep}" value="${yCapCur}"
           data-scatter-cap-key="${capKey}" data-cap-max="${yCapMax}" data-cap-unit="${unitLabel}">
  </label>`;
  // X 軸天數滑軸（連續，取代離散按鈕）
  const xCapCur = dayCap !== null ? dayCap : maxX;
  const xSlider = dayCapKey ? `<label class="scatter-slider-row">
    <span class="scatter-slider-label">天 ≤ <strong class="scatter-x-lbl" data-days-key="${dayCapKey}">${xCapCur}</strong>天</span>
    <input type="range" class="scatter-x-slider level-chart-slider"
           min="1" max="${maxX}" step="1" value="${xCapCur}"
           data-scatter-days-key="${dayCapKey}" data-days-max="${maxX}">
  </label>` : "";
  const defsHtml = refLineKey
    ? `<defs><clipPath id="scatter-ref-clip-${refLineKey}"><rect x="${PL}" y="${PT}" width="${cW}" height="${cH}"/></clipPath></defs>`
    : "";
  const refLayerHtml = refLineKey
    ? `<g class="scatter-ref-layer" data-ref-key="${refLineKey}" data-active-symbol=""></g>`
    : "";
  const svg = `<div class="shares-chart-container" style="position:relative">
    <svg viewBox="0 0 ${W} ${H}" class="level-chart-svg">
      ${defsHtml}${yLines.join("")}${zeroLine}${clipLine}${xLabels}${dots}${refLayerHtml}
      <text x="${PL}" y="${PT-2}" font-size="8" fill="var(--muted)" opacity="0.6">Y ▲</text>
      <text x="${W-PR}" y="${H-PB+20}" text-anchor="end" font-size="8" fill="var(--muted)" opacity="0.6">持有天數 ▶</text>
    </svg></div>`;
  const controls = `<div class="scatter-controls">
    <div class="scatter-controls-top"><div class="level-range-btns">${renderMarketBtns()}</div></div>
    <div class="scatter-sliders">${xSlider}${ySlider}</div>
  </div>`;
  return `${controls}${svg}`;
}

// ── 損益率 vs 持有天數 散點圖 ────────────────────────────────────────────────
function renderScatterChart(positions, quotes, firstBuyDates) {
  const today = new Date();
  const items = positions.map((p) => {
    const key = `${p.market}_${p.symbol}`;
    const firstBuy = firstBuyDates[key];
    if (!firstBuy) return null;
    const q = quotes[p.symbol];
    const price = typeof q === "number" ? q : (q?.price ?? null);
    if (price === null || price <= 0 || !(p.avgCost > 0)) return null;
    const days = Math.max(0, Math.floor((today - new Date(firstBuy)) / 86400000));
    const rate = (price - p.avgCost) / p.avgCost * 100;
    return { symbol: p.symbol, days, rate };
  }).filter(Boolean);
  if (items.length < 2) return "<p class=\"muted-text\">需要至少 2 支有首次布局日的標的才能顯示。</p>";
  const maxDays = Math.max(...items.map((i) => i.days), 1);
  const maxRate = Math.max(...items.map((i) => i.rate), 0);
  const capOptions = [
    { label: "全部", value: null },
    { label: `≤${Math.round(maxRate * 0.6)}%`, value: Math.round(maxRate * 0.6) },
    { label: `≤${Math.round(maxRate * 0.35)}%`, value: Math.round(maxRate * 0.35) },
    { label: "≤30%", value: 30 },
  ].filter((o, i, arr) => i === 0 || o.value === null || o.value > 10);
  const dayCapOptions = [
    { label: "全部", value: null },
    ...[90, 180, 365].filter(d => d < maxDays).map(d => ({ label: `≤${d}天`, value: d })),
  ];
  return buildScatterSvg({
    items, maxX: maxDays, capKey: "scatterRateCap", capOptions, unitLabel: "%",
    dayCapKey: "scatterRateDaysCap", dayCapOptions,
    getX: (i) => i.days, getY: (i) => i.rate,
    getColor: (i) => i.rate >= 0 ? "var(--green)" : "var(--red)",
    getTip: (i) => `${i.symbol} ${i.days}天 ${i.rate>=0?'+':''}${i.rate.toFixed(1)}%`,
  });
}

// ── 損益金額 vs 持有天數 散點圖 ─────────────────────────────────────────────
function renderPLAmountScatterChart(positions, quotes, firstBuyDates) {
  const today = new Date();
  const items = positions.map((p) => {
    const key = `${p.market}_${p.symbol}`;
    const firstBuy = firstBuyDates[key];
    if (!firstBuy) return null;
    const q = quotes[p.symbol];
    const price = typeof q === "number" ? q : (q?.price ?? null);
    if (price === null || price <= 0 || !(p.avgCost > 0)) return null;
    const days = Math.max(0, Math.floor((today - new Date(firstBuy)) / 86400000));
    const plRaw = (price - p.avgCost) * Number(p.shares || 0);
    const pl = marketForPosition(p) === "US" ? plRaw * getUsdTwdRate() : plRaw;
    return { symbol: p.symbol, days, pl };
  }).filter(Boolean);
  if (items.length < 2) return "<p class=\"muted-text\">需要至少 2 支有首次布局日的標的才能顯示。</p>";
  const maxDays = Math.max(...items.map((i) => i.days), 1);
  const maxPL = Math.max(...items.map((i) => i.pl), 0);
  const capOptions = [
    { label: "全部", value: null },
    { label: `≤${Math.round(maxPL * 0.6 / 1000)}k`, value: Math.round(maxPL * 0.6) },
    { label: `≤${Math.round(maxPL * 0.35 / 1000)}k`, value: Math.round(maxPL * 0.35) },
  ].filter((o) => o.value === null || o.value > 0);
  const dayCapOptions = [
    { label: "全部", value: null },
    ...[90, 180, 365].filter(d => d < maxDays).map(d => ({ label: `≤${d}天`, value: d })),
  ];
  return buildScatterSvg({
    items, maxX: maxDays, capKey: "scatterAmountCap", capOptions, unitLabel: "",
    dayCapKey: "scatterAmountDaysCap", dayCapOptions, refLineKey: "scatterAmountRef",
    getX: (i) => i.days, getY: (i) => i.pl,
    getColor: (i) => i.pl >= 0 ? "var(--green)" : "var(--red)",
    getTip: (i) => `${i.symbol} ${i.days}天 ${i.pl>=0?'+':''}${Math.round(i.pl).toLocaleString()}`,
    PL: 52,
  });
}

// ── 損益率分布直方圖 ────────────────────────────────────────────────────────
function renderRateHistogram(positions, quotes) {
  const buckets = [
    { label: "<-15%", min: -Infinity, max: -15, color: "#c0392b" },
    { label: "-15~-10", min: -15, max: -10, color: "#e74c3c" },
    { label: "-10~-5", min: -10, max: -5, color: "#e67e22" },
    { label: "-5~0", min: -5, max: 0, color: "#f39c12" },
    { label: "0~5%", min: 0, max: 5, color: "#27ae60" },
    { label: "5~10", min: 5, max: 10, color: "#2ecc71" },
    { label: "10~20", min: 10, max: 20, color: "#1abc9c" },
    { label: ">20%", min: 20, max: Infinity, color: "#16a085" },
  ];
  const rates = positions.map((p) => {
    const q = quotes[p.symbol];
    const price = typeof q === "number" ? q : (q?.price ?? null);
    if (price === null || price <= 0 || !(p.avgCost > 0)) return null;
    return (price - p.avgCost) / p.avgCost * 100;
  }).filter((r) => r !== null);
  if (!rates.length) return "<p class=\"muted-text\">尚無報價資料。</p>";
  const counts = buckets.map((b) => rates.filter((r) => r >= b.min && r < b.max).length);
  const maxCount = Math.max(...counts, 1);
  const W = 600, H = 140;
  const PL = 18, PR = 10, PT = 18, PB = 36;
  const cW = W - PL - PR, cH = H - PT - PB;
  const bW = cW / buckets.length;
  const baselineY = PT + cH;
  const bars = buckets.map((b, i) => {
    const cnt = counts[i];
    const barH = (cnt / maxCount) * cH;
    const x = PL + i * bW;
    const y = baselineY - barH;
    return `
      <rect x="${x+2}" y="${y}" width="${bW-4}" height="${barH}" fill="${b.color}" rx="2" opacity="0.85"/>
      ${cnt > 0 ? `<text x="${x+bW/2}" y="${y-3}" text-anchor="middle" font-size="10" fill="var(--text)" font-weight="600">${cnt}</text>` : ""}
      <text x="${x+bW/2}" y="${baselineY+12}" text-anchor="middle" font-size="8.5" fill="var(--muted)">${b.label}</text>`;
  }).join("");
  return `<div class="shares-chart-container">
    <svg viewBox="0 0 ${W} ${H}" class="level-chart-svg">
      <line x1="${PL}" y1="${baselineY}" x2="${W-PR}" y2="${baselineY}" stroke="var(--line)" stroke-width="1"/>
      ${bars}
    </svg></div>`;
}

function renderSnapCalendar(year, month, selectedDate, snapshotDates) {
  const monthLabel = `${year}年${month + 1}月`;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  const headers = weekDays.map((d) => `<span class="snap-cal-weekday">${d}</span>`).join("");
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push('<span class="snap-cal-empty"></span>');
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const cls = ["snap-cal-day", snapshotDates.has(dateStr) ? "has-snap" : "", selectedDate === dateStr ? "selected" : ""].filter(Boolean).join(" ");
    cells.push(`<button class="${cls}" type="button" data-cal-date="${dateStr}">${d}</button>`);
  }
  return `
    <div class="snap-calendar">
      <div class="snap-cal-nav">
        <button class="button compact secondary snap-cal-prev" type="button">◀</button>
        <span class="snap-cal-month">${escapeHtml(monthLabel)}</span>
        <button class="button compact secondary snap-cal-next" type="button">▶</button>
      </div>
      <div class="snap-cal-grid">${headers}${cells.join("")}</div>
    </div>
  `;
}

function renderLayoutSharesChart(cloudHistory) {
  const { snapshots, allPositions, dates } = buildSharesTimeline(cloudHistory);
  if (dates.length < 2) return "<p class=\"muted-text\">需要至少兩筆快照才能顯示趨勢。</p>";
  const colors = { TW: "var(--green)", US: "#4f8ef7" };
  const series = ["TW", "US"].map((market) => {
    const pts = dates.map((d, i) => {
      const snap = snapshots.find((s) => (s.date || s.createdAt?.slice(0, 10)) === d && normalizeMarketKey(s.market) === market);
      if (!snap) return null;
      const totalShares = allPositions.filter((row) => row.snapshotId === snap.snapshotId).reduce((sum, row) => sum + Number(row.shares || 0), 0);
      return totalShares > 0 ? { i, v: totalShares } : null;
    }).filter(Boolean);
    return { market, pts, color: colors[market] };
  });
  const legend = ["TW", "US"].map((m) => `<span class="level-legend-dot" style="background:${colors[m]}"></span>${marketLabel(m)}`).join(" ");
  return `<div class="level-chart-legend" style="margin-bottom:6px">${legend}</div>${renderSharesSvg(series, dates, colors)}`;
}

function renderSymbolSharesChart(symbol, cloudHistory) {
  // 直接從 positions 動態算 delta，避免 layout cache 不同步問題
  const positions = cloudHistory?.positions || [];
  const byMarket = {};
  for (const s of (cloudHistory?.snapshots || [])) {
    const mk = normalizeMarketKey(s.market);
    if (!byMarket[mk]) byMarket[mk] = [];
    byMarket[mk].push(s);
  }
  const deltaByDate = {};
  for (const mktSnaps of Object.values(byMarket)) {
    mktSnaps.sort((a, b) => String(a.date || a.createdAt).localeCompare(String(b.date || b.createdAt)));
    for (let i = 0; i < mktSnaps.length; i++) {
      const snap = mktSnaps[i];
      const date = snap.date || snap.createdAt?.slice(0, 10) || "";
      if (!date) continue;
      const curPos = positions.find((p) => p.snapshotId === snap.snapshotId && p.symbol === symbol);
      if (!curPos) continue;
      const prevPos = i > 0 ? positions.find((p) => p.snapshotId === mktSnaps[i - 1].snapshotId && p.symbol === symbol) : null;
      deltaByDate[date] = Number(curPos.shares ?? 0) - (prevPos ? Number(prevPos.shares ?? 0) : 0);
    }
  }
  const dates = Object.keys(deltaByDate).sort();
  if (!dates.length) return "";
  const pts = dates.map((d, i) => ({ i, v: deltaByDate[d] }));
  pts[0] = { ...pts[0], v: 0 }; // 第一筆為 basis
  return renderSharesSvg([{ pts, color: "var(--green)" }], dates, {});
}

function renderAllSymbolsChart(cloudHistory) {
  const layout = cloudHistory?.layout || [];
  if (!layout.length) return "<p class=\"muted-text\">需要至少兩筆快照才能顯示趨勢。</p>";
  const dates = [...new Set(layout.map((r) => r.date))].sort();
  if (dates.length < 2) return "<p class=\"muted-text\">需要至少兩筆快照才能顯示趨勢。</p>";
  const palette = ["#2f7d5b", "#4f8ef7", "#e07b39", "#9b59b6", "#e74c3c", "#1abc9c", "#f39c12", "#2980b9"];
  const symbols = [...new Set(layout.map((r) => r.symbol))].sort();
  const series = symbols.map((symbol, si) => {
    const pts = dates.map((d, i) => {
      const row = layout.find((r) => r.symbol === symbol && r.date === d);
      return row ? { i, v: row.delta } : null;
    }).filter(Boolean);
    return { symbol, pts, color: palette[si % palette.length] };
  }).filter((s) => s.pts.length > 0);
  if (!series.length) return "<p class=\"muted-text\">尚無布局差異資料。</p>";
  const legend = series.map((s) => `<span class="level-legend-dot" style="background:${s.color}"></span>${escapeHtml(s.symbol)}`).join(" ");
  return `<div class="level-chart-legend" style="margin-bottom:6px;flex-wrap:wrap">${legend}</div>${renderSharesSvg(series, dates, {})}`;
}

function widthPercent(value, max) {
  if (!value || !max) return 0;
  return Math.max(2, Math.min(100, (value / max) * 100));
}

function targetGapClass(gap, hasTarget) {
  if (!hasTarget) return "neutral";
  if (gap > 0.5) return "high";
  if (gap < -0.5) return "low";
  return "balanced";
}

// ── 批次設定首次布局日面板 ───────────────────────────────────────────────────
function renderBatchFirstBuyPanel(market, rows) {
  const missing = rows.filter((row) => !state.firstBuyDates[`${market}_${row.symbol}`]);
  if (!missing.length) {
    return `<div class="batch-firstbuy-panel"><p class="muted-text">所有標的均已設定首次布局日。</p></div>`;
  }
  const inputRows = missing.map((row) => `
    <div class="batch-firstbuy-row">
      <span class="batch-firstbuy-symbol">${escapeHtml(row.symbol)}</span>
      <span class="batch-firstbuy-name muted-text">${escapeHtml(row.name || "")}</span>
      <input type="date" class="batch-firstbuy-input cell-input"
             data-market="${escapeHtml(market)}" data-symbol="${escapeHtml(row.symbol)}">
    </div>
  `).join("");
  return `
    <div class="batch-firstbuy-panel">
      <p class="muted-text" style="margin-bottom:8px">尚未設定（${missing.length} 支）：填入日期後點「全部儲存」，留空的跳過。</p>
      <div class="batch-firstbuy-list">${inputRows}</div>
      <button class="button primary batch-firstbuy-save-btn" data-market="${escapeHtml(market)}" style="margin-top:10px">全部儲存</button>
    </div>
  `;
}

function renderCloudSnapshot() {
  if (!els.cloudSnapshot) return;
  const cloud = state.cloudSnapshot;
  if (!cloud?.snapshot) {
    const title = state.cloudLoading ? "正在載入雲端庫存" : "登入後會自動載入目前庫存";
    const body = state.cloudLoading
      ? "正在讀取 Google Sheet 的最新快照與歷史資料。"
      : "目前還沒有雲端快照。先把確認後的庫存截圖「合併存雲端」，這裡就會變成每天看庫存、水位和趨勢的首頁。";
    els.cloudSnapshot.innerHTML = `
      <div class="dashboard-empty">
        <p class="section-eyebrow">Dashboard</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(body)}</p>
      </div>
    `;
    renderSummaryLine();
    return;
  }
  // 取各市場最新快照的 positions 合併（台股最新 + 美股最新）
  // cloud.positions 只有「整體最新一筆」，不一定涵蓋兩個市場
  const _allSnapshotsSorted = (state.cloudHistory.snapshots || [])
    .slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const _latestByMarket = {};
  for (const snap of _allSnapshotsSorted) {
    const mkt = normalizeMarketKey(snap.market);
    if (!_latestByMarket[mkt]) _latestByMarket[mkt] = snap;
  }
  const _latestSnapIds = new Set(Object.values(_latestByMarket).map((s) => s.snapshotId));
  const positions = (state.cloudHistory.positions || []).filter((p) => _latestSnapIds.has(p.snapshotId));
  // B tab：歷史快照選擇器所需變數
  const availableSnapshotDates = [...new Set(
    (state.cloudHistory.snapshots || []).map((s) => s.date).filter(Boolean)
  )].sort().reverse();
  const selectedDate = state.selectedSnapshotDate || availableSnapshotDates[0] || cloud.snapshot.date;
  const selectedSnapshotIds = new Set(
    (state.cloudHistory.snapshots || []).filter((s) => s.date === selectedDate).map((s) => s.snapshotId)
  );
  const holdingsRaw = selectedSnapshotIds.size > 0
    ? (state.cloudHistory.positions || []).filter((p) => selectedSnapshotIds.has(p.snapshotId))
    : positions;
  const holdingsWithMarket = holdingsRaw.map((row) => ({
    ...row, marketKey: marketForPosition(row), cost: estimatedCost(row),
  }));
  const holdingsMarketSummaries = ["TW", "US"].map((market) => {
    const marketRows = holdingsWithMarket.filter((r) => r.marketKey === market).sort((a, b) => b.cost - a.cost);
    return {
      market,
      rows: marketRows,
      stockCount: marketRows.length,
      totalShares: marketRows.reduce((sum, r) => sum + Number(r.shares || 0), 0),
      totalCost: marketRows.reduce((sum, r) => sum + r.cost, 0),
      targetLevel: targetLevelForMarket(market, selectedDate),
    };
  });
  // 查找對應截圖 entry
  const matchingEntry = state.entries.find((e) =>
    e.sheetSnapshotId && [...selectedSnapshotIds].some((id) => e.sheetSnapshotId.split(",").map((s) => s.trim()).includes(id))
  ) || null;
  const positionsWithMarket = positions.map((row) => ({
    ...row,
    marketKey: marketForPosition(row),
    cost: estimatedCost(row),
  }));
  const totalShares = positionsWithMarket.reduce((sum, row) => sum + Number(row.shares || 0), 0);
  const totalCost = positionsWithMarket.reduce((sum, row) => sum + row.cost, 0);
  const marketSummaries = ["TW", "US"].map((market) => {
    const marketRows = positionsWithMarket
      .filter((row) => row.marketKey === market)
      .sort((a, b) => b.cost - a.cost);
    const marketCost = marketRows.reduce((sum, row) => sum + row.cost, 0);
    const marketShares = marketRows.reduce((sum, row) => sum + Number(row.shares || 0), 0);
    return {
      market,
      rows: marketRows,
      stockCount: marketRows.length,
      totalShares: marketShares,
      totalCost: marketCost,
      targetLevel: targetLevelForMarket(market, cloud.snapshot.date),
    };
  });
  const history = (state.cloudHistory.snapshots || [])
    .slice(0, 10)
    .map(snapshotMetrics)
    .reverse();
  const maxHistoryCost = Math.max(...history.map((item) => item.totalCost), 0);
  const maxHistoryShares = Math.max(...history.map((item) => item.totalShares), 0);
  const maxMarketCost = Math.max(...marketSummaries.map((item) => item.totalCost), 0);
  const layoutAnalysis = buildLayoutAnalysis();
  const marketCards = marketSummaries.map((item) => {
    const todayStr = today();
    const mktHistory = state.targetLevelHistory.filter((h) => h.market === item.market);
    const todayRecord = mktHistory.find((h) => h.date === todayStr);
    const lastRecord = mktHistory[0];
    const inputVal = todayRecord ? todayRecord.targetLevel : (item.targetLevel ?? "");
    const lastRecordText = lastRecord
      ? `上次：${lastRecord.date} ${formatPercent(lastRecord.targetLevel)}`
      : "尚未記錄";
    return `
    <section class="market-water-card">
      <div class="card-heading">
        <h3>${marketLabel(item.market)}</h3>
        <span>${item.stockCount} 檔庫存</span>
      </div>
      <div class="market-water-main">
        <div>
          <span>方舟建議總水位</span>
          <strong>${item.targetLevel === null ? "未設定" : formatPercent(item.targetLevel)}</strong>
        </div>
        <div class="level-update-panel">
          <div class="level-update-row">
            <input class="target-level-input cell-input" data-target-level-market="${escapeHtml(item.market)}" type="number" min="0" max="100" step="0.1" inputmode="decimal" placeholder="水位%" value="${escapeHtml(String(inputVal))}">
            <span class="level-unit">%</span>
            <button class="button compact icon-btn level-update-btn" title="更新水位" data-target-level-market="${escapeHtml(item.market)}">↺</button>
          </div>
          <div class="level-last-record" data-level-last="${escapeHtml(item.market)}">${escapeHtml(lastRecordText)}</div>
        </div>
      </div>
      <div class="market-stats">
        <span>估算投入成本 <b>${formatMoney(item.totalCost)}</b></span>
        <span>總股數 <b>${formatNumber(item.totalShares, 3)}</b></span>
      </div>
    </section>
  `;
  }).join("");
  const trendBars = history.map((item) => `
    <div class="trend-day">
      <div class="trend-bars">
        <span class="trend-cost" style="height: ${widthPercent(item.totalCost, maxHistoryCost)}%"></span>
        <span class="trend-shares" style="height: ${widthPercent(item.totalShares, maxHistoryShares)}%"></span>
      </div>
      <small>${escapeHtml(item.date?.slice(5) || item.createdAt?.slice(5, 10) || "")}</small>
    </div>
  `).join("");
  const dailyRowsByMarket = ["TW", "US"].map((market) => {
    const marketHistory = history.slice().reverse().map((item) => {
      const marketPositions = item.positions.filter((row) => normalizeMarketKey(row.market) === market);
      return {
        ...item,
        stockCount: marketPositions.length,
        totalShares: marketPositions.reduce((sum, row) => sum + Number(row.shares || 0), 0),
        totalCost: marketPositions.reduce((sum, row) => sum + estimatedCost(row), 0),
      };
    }).filter((item) => item.stockCount > 0);
    if (!marketHistory.length) return "";
    const rows = marketHistory.map((item) => `
      <tr>
        <td>${escapeHtml(item.date || "")}</td>
        <td>${escapeHtml(formatNumber(item.stockCount))}</td>
        <td>${escapeHtml(formatNumber(item.totalShares, 3))}</td>
        <td>${escapeHtml(formatMoney(item.totalCost))}</td>
      </tr>
    `).join("");
    return `
      <h4 class="market-section-heading">${marketLabel(market)}</h4>
      <div class="table-scroll compact-table">
        <table class="parsed-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>檔數</th>
              <th>總股數</th>
              <th>估算投入成本</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");
  const marketDetailSections = holdingsMarketSummaries.map((item) => {
    // 上一筆快照（同市場，相對於選擇的日期）用來計算損益率 delta
    const mktSnaps = (state.cloudHistory.snapshots || [])
      .filter((s) => normalizeMarketKey(s.market) === item.market)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const curSnapIdx = mktSnaps.findIndex((s) => selectedSnapshotIds.has(s.snapshotId));
    const prevSnap = curSnapIdx >= 0 ? mktSnaps[curSnapIdx + 1] : null;
    const prevPositions = prevSnap
      ? (state.cloudHistory.positions || []).filter((p) => p.snapshotId === prevSnap.snapshotId)
      : [];
    // 1. 計算每列數值
    const augmented = item.rows.map((row) => {
      const quote = state.quotes[row.symbol];
      const price = typeof quote === 'number' ? quote : (quote?.price ?? null);
      const avgCost = Number(row.avgCost || 0);
      const returnRate = (price !== null && avgCost > 0) ? ((price - avgCost) / avgCost * 100) : null;
      const days = holdingDays(item.market, row.symbol);
      const perfRate = (returnRate !== null && days) ? returnRate / days : null;
      const shares = Number(row.shares || 0);
      const fxRate = item.market === "US" ? getUsdTwdRate() : 1;
      const unrealizedPnl = (price !== null && avgCost > 0) ? ((price - avgCost) * shares * fxRate) : null;
      const dailyGain = (unrealizedPnl !== null && days) ? unrealizedPnl / days : null;
      const firstBuyVal = state.firstBuyDates[`${item.market}_${row.symbol}`] || '';
      const holdDays = firstBuyVal ? Math.max(0, Math.floor((Date.now() - new Date(firstBuyVal).getTime()) / 86400000)) : null;
      const prevPos = prevPositions.find((p) => p.symbol === row.symbol);
      const prevAvgCost = prevPos ? Number(prevPos.avgCost || 0) : null;
      const prevRate = (price !== null && prevAvgCost && prevAvgCost > 0)
        ? ((price - prevAvgCost) / prevAvgCost * 100)
        : null;
      const rateDelta = (returnRate !== null && prevRate !== null) ? returnRate - prevRate : null;
      return { row, price, avgCost, returnRate, perfRate, dailyGain, firstBuyVal, holdDays, rateDelta };
    });
    // 2. 排序
    const { key: sKey, dir: sDir } = state.detailSort;
    augmented.sort((a, b) => {
      let va, vb;
      switch (sKey) {
        case "symbol":   va = a.row.symbol;    vb = b.row.symbol;    break;
        case "name":     va = a.row.name;      vb = b.row.name;      break;
        case "shares":   va = a.row.shares;    vb = b.row.shares;    break;
        case "avgCost":  va = a.avgCost;       vb = b.avgCost;       break;
        case "price":    va = a.price;         vb = b.price;         break;
        case "rate":      va = a.returnRate;    vb = b.returnRate;    break;
        case "perf":     va = a.perfRate;       vb = b.perfRate;       break;
        case "dailyGain":va = a.dailyGain;      vb = b.dailyGain;      break;
        case "cost":      va = a.row.cost;      vb = b.row.cost;      break;
        case "firstBuy":  va = a.holdDays;       vb = b.holdDays;      break;
        default:         va = a.row.symbol;    vb = b.row.symbol;
      }
      if (va == null || va === '') return 1;
      if (vb == null || vb === '') return -1;
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return sDir === 'asc' ? cmp : -cmp;
    });
    // 3. Render
    const sortArrow = (key) => state.detailSort.key === key ? (state.detailSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    const rows = augmented.map(({ row, price, returnRate, perfRate, dailyGain, firstBuyVal, holdDays, rateDelta }) => {
      const priceCell = price !== null ? escapeHtml(formatNumber(price, 2)) : "<span class=\"muted-text\">—</span>";
      const deltaSpan = rateDelta !== null
        ? `<small style="color:${rateDelta >= 0 ? 'var(--green)' : 'var(--red)'};display:block">${rateDelta >= 0 ? '▲' : '▼'}${Math.abs(rateDelta).toFixed(1)}%</small>`
        : '';
      const rateDisplay = returnRate !== null
        ? `<span style="color:${returnRate >= 0 ? 'var(--green)' : 'var(--red)'}">${returnRate >= 0 ? '+' : ''}${returnRate.toFixed(1)}%</span>${deltaSpan}`
        : "<span class=\"muted-text\">—</span>";
      const perfColor = perfRate !== null ? (perfRate >= 0 ? 'var(--green)' : 'var(--red)') : '';
      const perfDisplay = perfRate !== null
        ? `<span style="color:${perfColor};font-variant-numeric:tabular-nums">${perfRate >= 0 ? '+' : ''}${perfRate.toFixed(2)}</span>`
        : "<span class=\"muted-text\">—</span>";
      const gainColor = dailyGain !== null ? (dailyGain >= 0 ? 'var(--green)' : 'var(--red)') : '';
      const dailyGainDisplay = dailyGain !== null
        ? `<span style="color:${gainColor};font-variant-numeric:tabular-nums">${dailyGain >= 0 ? '+' : ''}${formatNumber(Math.round(dailyGain))}</span>`
        : "<span class=\"muted-text\">—</span>";
      const editMode = !!state.detailEditMode[item.market];
      const sharesCell = editMode
        ? `<input class="cell-input edit-shares-input" type="number" step="0.001" value="${row.shares || 0}" data-market="${escapeHtml(item.market)}" data-symbol="${escapeHtml(row.symbol)}">`
        : escapeHtml(displayValue(row.shares));
      const avgCostCell = editMode
        ? `<input class="cell-input edit-avgcost-input" type="number" step="0.001" value="${row.avgCost || 0}" data-market="${escapeHtml(item.market)}" data-symbol="${escapeHtml(row.symbol)}">`
        : escapeHtml(displayValue(row.avgCost));
      const holdDaysDisplay = holdDays !== null ? `${holdDays}天` : '<span class="muted-text">—</span>';
      const firstBuyCell = editMode
        ? `${holdDays !== null ? `<span class="hold-days-text">${holdDays}天</span>` : '<span class="muted-text">—</span>'}
           <button class="button compact secondary first-buy-edit-btn" data-market="${escapeHtml(item.market)}" data-symbol="${escapeHtml(row.symbol)}" data-current="${escapeHtml(firstBuyVal)}">${firstBuyVal ? "修改" : "設定"}</button>
           <button class="button compact primary edit-row-save-btn" data-market="${escapeHtml(item.market)}" data-symbol="${escapeHtml(row.symbol)}">儲存</button>`
        : holdDaysDisplay;
      return `
        <tr class="symbol-row" data-symbol-row="${escapeHtml(row.symbol)}" data-symbol-name="${escapeHtml(row.name)}" tabindex="0"${editMode ? '' : ' style="cursor:pointer"'}>
          <td data-label="代號">${escapeHtml(row.symbol)}</td>
          <td data-label="名稱">${escapeHtml(row.name)}</td>
          <td data-label="股數">${sharesCell}</td>
          <td data-label="均價">${avgCostCell}</td>
          <td data-label="現價">${priceCell}</td>
          <td data-label="損益率">${rateDisplay}</td>
          <td data-label="表現率">${perfDisplay}</td>
          <td data-label="日均損益">${dailyGainDisplay}</td>
          <td data-label="估算成本">${escapeHtml(formatMoney(row.cost))}</td>
          <td class="first-buy-cell" data-label="持有天數">${firstBuyCell}</td>
        </tr>
      `;
    }).join("");
    const quoteLoading = Object.keys(state.quotes).length === 0
      ? "<p class=\"muted-text quote-loading\">正在載入現價…</p>" : "";
    return `
      <section class="market-detail-section">
        <div class="card-heading">
          <h3>${marketLabel(item.market)}明細</h3>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span>建議水位 ${item.targetLevel === null ? "未設定" : formatPercent(item.targetLevel)}</span>
            <button class="button compact secondary batch-firstbuy-toggle-btn"
                    data-market="${escapeHtml(item.market)}">
              ${state.batchFirstBuyMode[item.market] ? "關閉" : "批次設定布局日"}
            </button>
          </div>
        </div>
        ${state.batchFirstBuyMode[item.market] ? renderBatchFirstBuyPanel(item.market, item.rows) : ""}
        ${quoteLoading}
        <div class="table-scroll compact-table">
          <table class="parsed-table">
            <thead>
              <tr>
                <th class="sortable-th" data-sort-key="symbol">代號${sortArrow("symbol")}</th>
                <th class="sortable-th" data-sort-key="name">名稱${sortArrow("name")}</th>
                <th class="sortable-th" data-sort-key="shares">股數${sortArrow("shares")}</th>
                <th class="sortable-th" data-sort-key="avgCost">成交均價${sortArrow("avgCost")}</th>
                <th class="sortable-th" data-sort-key="price">現價${sortArrow("price")}</th>
                <th class="sortable-th" data-sort-key="rate">損益率${sortArrow("rate")}</th>
                <th class="sortable-th" data-sort-key="perf">表現率（%/日）${sortArrow("perf")}</th>
                <th class="sortable-th" data-sort-key="dailyGain">日均損益（元）${sortArrow("dailyGain")}</th>
                <th class="sortable-th" data-sort-key="cost">估算成本${sortArrow("cost")}</th>
                <th class="sortable-th" data-sort-key="firstBuy">持有天數${sortArrow("firstBuy")} <button class="detail-edit-toggle${state.detailEditMode[item.market] ? ' active' : ''}" data-edit-market="${escapeHtml(item.market)}" title="${state.detailEditMode[item.market] ? '關閉編輯模式' : '開啟編輯（可修改股數、均價、布局日）'}">✎</button></th>
              </tr>
            </thead>
            <tbody>${rows || "<tr><td colspan=\"10\">沒有庫存</td></tr>"}</tbody>
          </table>
        </div>
      </section>
    `;
  }).join("");
  const validDashboardTabs = new Set(["home", "holdings", "capture"]);
  if (!validDashboardTabs.has(state.dashboardTab)) state.dashboardTab = "home";
  const mkt = state.levelChartMarket || "TW";
  const filteredPositions = mkt === "ALL" ? positions : positions.filter((p) => marketForPosition(p) === mkt);
  const performanceRows = filteredPositions
    .filter((p) => {
      const q = state.quotes[p.symbol];
      const price = typeof q === 'number' ? q : (q?.price ?? null);
      return p.avgCost > 0 && price !== null && price > 0;
    })
    .map((p) => {
      const q = state.quotes[p.symbol];
      const price = typeof q === 'number' ? q : (q?.price ?? 0);
      const rate = (price - p.avgCost) / p.avgCost * 100;
      return { symbol: p.symbol, name: p.name, rate };
    })
    .sort((a, b) => b.rate - a.rate);
  const top3 = performanceRows.slice(0, 3);
  const bottom3 = performanceRows.slice(-3).reverse();
  const perfRow = (r) => `<tr><td>${escapeHtml(r.symbol)}</td><td>${escapeHtml(r.name)}</td><td class="perf-rate-cell" style="color:${r.rate >= 0 ? 'var(--green)' : 'var(--red)'}">${r.rate >= 0 ? '+' : ''}${r.rate.toFixed(1)}%</td></tr>`;
  const perfTable = (rows) => rows.length ? `<div class="compact-table"><table class="parsed-table perf-rank-table"><thead><tr><th>代號</th><th>名稱</th><th class="perf-rate-cell">損益率</th></tr></thead><tbody>${rows.map(perfRow).join('')}</tbody></table></div>` : '<p class="muted-text">尚無報價資料。</p>';
  const homeContent = `
    <div class="metric-grid">
      <div class="metric">
        <span>庫存檔數</span>
        <strong>${formatNumber(positions.length)}</strong>
      </div>
      <div class="metric">
        <span>總股數</span>
        <strong>${formatNumber(totalShares, 3)}</strong>
      </div>
      <div class="metric">
        <span>估算投入成本</span>
        <strong>${formatMoney(totalCost)}</strong>
      </div>
      <div class="metric">
        <span>雲端快照</span>
        <strong>${formatNumber(state.cloudHistory.snapshots.length)}</strong>
      </div>
    </div>

    <div class="dashboard-grid">
      <section class="dashboard-card">
        <div class="card-heading">
          <h3>市場水位</h3>
          <span>建議水位為各市場庫存占總資金的比例</span>
        </div>
        <div class="market-water-grid">${marketCards}</div>
      </section>

      <section class="dashboard-card">
        <div class="card-heading">
          <h3>建議水位趨勢</h3>
          <span>台股 / 美股歷史建議水位（%）</span>
        </div>
        ${renderTargetLevelChart(state.targetLevelHistory)}
      </section>
    </div>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>損益趨勢</h3>
        <span>未實現總損益（台幣；美股依 USD/TWD ${getUsdTwdRate().toFixed(2)} 折算）</span>
      </div>
      <div class="trend-chart">${renderSnapshotTrendChart(state.cloudHistory, state.quotes, mkt)}</div>
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>損益率排名</h3>
        <span>依（現價－均價）/ 均價；有首次布局日者另顯示表現率</span>
        <div class="level-range-btns">${renderMarketBtns()}</div>
      </div>
      <div class="perf-rank-grid">
        <div>
          <p class="section-eyebrow">前三名</p>
          ${perfTable(top3)}
        </div>
        <div>
          <p class="section-eyebrow">倒數三名</p>
          ${perfTable(bottom3)}
        </div>
      </div>
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>損益率趨勢</h3>
        <span>整體平均損益率（依各快照均價 × 現價估算，單位 %）</span>
      </div>
      <div class="trend-chart">${renderPerfRateTrendChart(state.cloudHistory, state.quotes, mkt)}</div>
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>個股損益貢獻</h3>
        <span>各標的未實現損益金額（台幣）</span>
        <div class="level-range-btns">${renderMarketBtns()}</div>
      </div>
      ${renderPLContributionChart(filteredPositions, state.quotes)}
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>損益率 vs 持有天數</h3>
        <span>X 軸：首次布局至今；Y 軸：損益率（需有首次布局日）</span>
      </div>
      ${renderScatterChart(filteredPositions, state.quotes, state.firstBuyDates)}
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>損益金額 vs 持有天數</h3>
        <span>X 軸：首次布局至今；Y 軸：未實現損益金額（台幣，需有首次布局日）</span>
      </div>
      ${renderPLAmountScatterChart(filteredPositions, state.quotes, state.firstBuyDates)}
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>損益率分布</h3>
        <span>各損益率區間持有幾支</span>
        <div class="level-range-btns">${renderMarketBtns()}</div>
      </div>
      ${renderRateHistogram(filteredPositions, state.quotes)}
    </section>

  `;
  const snapshotDeleteContent = `
    <section class="dashboard-card">
      <div class="card-heading">
        <h3>刪除當日庫存紀錄</h3>
        <span>點選有庫存的日期（圓點標示）後刪除</span>
      </div>
      ${renderSnapCalendar(
        state.homeCalendar.year,
        state.homeCalendar.month,
        state.homeCalendar.selectedDate,
        new Set((state.cloudHistory.snapshots || []).map((s) => s.date || "").filter(Boolean))
      )}
      <input type="hidden" id="home-delete-snapshot-date" value="${escapeHtml(state.homeCalendar.selectedDate)}">
      <div class="snapshot-delete-row" style="margin-top:10px">
        <select id="home-delete-snapshot-market">
          <option value="all" selected>台股+美股</option>
          <option value="TW">台股</option>
          <option value="US">美股</option>
        </select>
        <button id="home-delete-cloud-snapshot" class="button danger compact" type="button">刪除</button>
      </div>
      <p id="home-delete-snapshot-preview" class="snapshot-delete-preview">${escapeHtml(snapshotDeletePreviewText(state.homeCalendar.selectedDate, "all"))}</p>
    </section>
  `;
  const holdingsContent = `
    <section class="dashboard-card">
      <div class="card-heading">
        <h3>庫存明細</h3>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <select id="holdings-date-select" class="cell-input" style="width:auto">
            ${availableSnapshotDates.map((d) =>
              `<option value="${escapeHtml(d)}"${d === selectedDate ? " selected" : ""}>${escapeHtml(d)}</option>`
            ).join("")}
          </select>
          <span class="muted-text">${holdingsRaw.length} 筆庫存</span>
          ${matchingEntry
            ? `<button class="button compact secondary" id="view-entry-btn" data-entry-id="${escapeHtml(matchingEntry.id)}">查看截圖</button>`
            : ""}
          ${(state.cloudHistory.positions || []).some((p) => normalizeTWSymbol(p.symbol) !== p.symbol)
            ? `<button class="button compact ghost danger" id="fix-symbols-btn" title="偵測到 Sheet 有代號缺 00 前綴">修正代號</button>`
            : ""}
          ${(state.cloudHistory.positions || []).some((p) => Number(p.shares || 0) === 0 && Number(p.avgCost || 0) === 0)
            ? `<button class="button compact ghost danger" id="cleanup-zero-btn" title="偵測到 Sheet 有股數=0 且均價=0 的廢棄倉位">清除廢棄列</button>`
            : ""}
          ${!(state.cloudHistory.layout || []).length
            ? `<button class="button compact secondary" id="rebuild-layout-btn" title="AssetFlowLayout tab 是空的，點此從現有快照重建">重建布局歷史</button>`
            : ""}
        </div>
      </div>
      <div id="symbol-chart-display" class="symbol-chart-display" style="display:none">
        <div id="symbol-chart-content"></div>
      </div>
      <div class="market-detail-grid">${marketDetailSections}</div>
    </section>
    ${snapshotDeleteContent}
  `;
  const captureEntriesHtml = state.entries.length > 0
    ? `<div class="capture-entries-list">
        ${state.entries.slice(0, 30).map((e) => {
          const parsedCount = (e.parsedRows || []).filter((r) => r.symbol).length;
          return `<div class="capture-entry-row" data-entry-id="${escapeHtml(e.id)}">
            <span class="entry-status ${escapeHtml(e.status)}">${statusLabel(e.status)}</span>
            <span class="entry-name" style="font-variant-numeric:tabular-nums">${escapeHtml(e.date || '—')}</span>
            <span class="muted-text" style="white-space:nowrap">${escapeHtml(marketLabel(e.market))}</span>
            <span class="entry-count">${parsedCount ? `${parsedCount} 筆` : '—'}</span>
          </div>`;
        }).join('')}
      </div>`
    : '<p class="muted-text">尚無已儲存截圖。</p>';
  const captureContent = `
    <section class="dashboard-card capture-tab-card">
      <div class="card-heading">
        <h3>新增庫存截圖</h3>
        <span>打開截圖入口後可貼上、拖放或選檔</span>
      </div>
      <p class="muted-text">確認截圖解析後，可用「合併存雲端」寫入 Google Sheet，dashboard 會重新載入最新庫存。</p>
      <button id="dashboard-open-capture" class="button primary" type="button">新增截圖</button>
    </section>
    <section class="dashboard-card">
      <div class="card-heading">
        <h3>已儲存截圖</h3>
        <span>${state.entries.length} 張</span>
      </div>
      ${captureEntriesHtml}
      ${state.entries.some((e) => e.status === "imported" && e.title?.includes("${els."))
        ? `<button id="bulk-clear-old" class="button ghost danger" type="button" style="margin-top:10px;font-size:12px;">清除壞標題舊截圖（已匯入）</button>`
        : ""}
    </section>
  `;
  const tabContent = {
    home: homeContent,
    holdings: holdingsContent,
    capture: captureContent,
  }[state.dashboardTab];
  els.cloudSnapshot.innerHTML = `
    <header class="dashboard-header">
      <div>
        <p class="section-eyebrow">Dashboard</p>
        <h2>目前庫存</h2>
        <p>${escapeHtml(cloud.snapshot.date)} · ${marketLabel(cloud.snapshot.market)} · ${escapeHtml(cloud.snapshot.createdAt)}</p>
      </div>
      <div class="dashboard-actions">
        <button id="dashboard-refresh" class="button secondary compact" type="button">重新整理</button>
      </div>
    </header>

    <div class="dashboard-tab-content">${tabContent}</div>
    <nav class="dashboard-tabs" role="tablist" aria-label="AssetFlow Invest">
      ${dashboardTabButton("home", "首頁")}
      ${dashboardTabButton("holdings", "庫存")}
      ${dashboardTabButton("capture", "新增")}
    </nav>
  `;
  els.cloudSnapshot.querySelector("#dashboard-refresh")?.addEventListener("click", () => {
    swRegistration?.update?.().catch(() => {});
    loadLatestCloudSnapshot(true);
  });
  els.cloudSnapshot.querySelector("#cleanup-duplicates")?.addEventListener("click", cleanupDuplicateCloudSnapshots);
  els.cloudSnapshot.querySelector("#dashboard-open-capture")?.addEventListener("click", openCapturePanel);
  els.cloudSnapshot.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.dashboardTab = button.dataset.dashboardTab || "home";
      renderCloudSnapshot();
    });
  });
  els.cloudSnapshot.querySelectorAll("[data-delete-snapshot-id]").forEach((button) => {
    button.addEventListener("click", () => deleteCloudSnapshotById(button.dataset.deleteSnapshotId, button));
  });
  bindSwipeDeleteRows(els.cloudSnapshot);
  const deleteDate = els.cloudSnapshot.querySelector("#delete-snapshot-date");
  const deleteMarket = els.cloudSnapshot.querySelector("#delete-snapshot-market");
  const deletePreview = els.cloudSnapshot.querySelector("#delete-snapshot-preview");
  const updateDeletePreview = () => {
    if (!deletePreview || !deleteDate || !deleteMarket) return;
    deletePreview.textContent = snapshotDeletePreviewText(deleteDate.value, deleteMarket.value);
  };
  deleteDate?.addEventListener("change", updateDeletePreview);
  deleteMarket?.addEventListener("change", updateDeletePreview);
  els.cloudSnapshot.querySelector("#delete-cloud-snapshot")?.addEventListener("click", deleteSelectedCloudSnapshots);
  const homeDeleteMarket = els.cloudSnapshot.querySelector("#home-delete-snapshot-market");
  const homeDeletePreview = els.cloudSnapshot.querySelector("#home-delete-snapshot-preview");
  const updateHomeDeletePreview = () => {
    if (!homeDeletePreview || !homeDeleteMarket) return;
    homeDeletePreview.textContent = snapshotDeletePreviewText(state.homeCalendar.selectedDate, homeDeleteMarket.value);
  };
  homeDeleteMarket?.addEventListener("change", updateHomeDeletePreview);
  els.cloudSnapshot.querySelector("#home-delete-cloud-snapshot")?.addEventListener("click", () => deleteSelectedCloudSnapshots({ buttonId: "home-delete-cloud-snapshot", dateId: "home-delete-snapshot-date", marketId: "home-delete-snapshot-market" }));
  els.cloudSnapshot.querySelector(".snap-cal-prev")?.addEventListener("click", () => {
    let { year, month, selectedDate } = state.homeCalendar;
    month--; if (month < 0) { month = 11; year--; }
    state.homeCalendar = { year, month, selectedDate };
    renderCloudSnapshot();
  });
  els.cloudSnapshot.querySelector(".snap-cal-next")?.addEventListener("click", () => {
    let { year, month, selectedDate } = state.homeCalendar;
    month++; if (month > 11) { month = 0; year++; }
    state.homeCalendar = { year, month, selectedDate };
    renderCloudSnapshot();
  });
  els.cloudSnapshot.querySelectorAll(".snap-cal-day").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.homeCalendar.selectedDate = btn.dataset.calDate;
      renderCloudSnapshot();
      const preview = els.cloudSnapshot.querySelector("#home-delete-snapshot-preview");
      const market = els.cloudSnapshot.querySelector("#home-delete-snapshot-market");
      if (preview && market) {
        preview.textContent = snapshotDeletePreviewText(state.homeCalendar.selectedDate, market.value);
      }
    });
  });
  els.cloudSnapshot.querySelectorAll(".level-update-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const market = btn.dataset.targetLevelMarket;
      const panel = btn.closest(".level-update-panel");
      const input = panel?.querySelector("input[data-target-level-market]");
      if (!input) return;
      if (!updateTargetLevel(market, input.value)) return;
      const feedback = panel?.querySelector(".level-last-record");
      if (feedback) feedback.textContent = "同步中…";
      btn.disabled = true;
      try {
        await saveTargetLevelToSheet(market, state.targetLevels[market]);
        renderCloudSnapshot();
      } catch {
        if (feedback) feedback.textContent = "儲存失敗，請重試";
        btn.disabled = false;
      }
    });
  });
  // 所有趨勢圖 tooltip：用事件委派取代靜態綁定，確保動態插入的個股走勢圖也生效
  els.cloudSnapshot.addEventListener("click", (e) => {
    const dot = e.target.closest
      ? e.target.closest("circle[data-tooltip]")
      : (e.target.tagName === "circle" && e.target.dataset.tooltip ? e.target : null);
    if (!dot?.dataset.tooltip) return;
    const container = dot.closest(".shares-chart-container") || dot.closest(".level-chart-container");
    if (!container) return;
    let tip = container.querySelector(".chart-tooltip");
    if (!tip) { tip = document.createElement("div"); tip.className = "chart-tooltip"; container.appendChild(tip); }
    tip.textContent = dot.dataset.tooltip;
    tip.style.display = "block";
    setTimeout(() => { tip.style.display = "none"; }, 2500);
    e.stopPropagation();
  }, { capture: false });
  els.cloudSnapshot.querySelectorAll("[data-level-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.levelChartRange = btn.dataset.levelRange;
      renderCloudSnapshot();
    });
  });
  els.cloudSnapshot.querySelectorAll("[data-level-market]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.levelChartMarket = btn.dataset.levelMarket;
      renderCloudSnapshot();
    });
  });
  els.cloudSnapshot.querySelectorAll("[data-pl-trend-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.plTrendRange = btn.dataset.plTrendRange;
      renderCloudSnapshot();
    });
  });
  // Y 軸滑軸：input 即時更新標籤，change 重繪圖表
  els.cloudSnapshot.querySelectorAll(".scatter-y-slider").forEach((slider) => {
    slider.addEventListener("input", () => {
      const val = Number(slider.value);
      const max = Number(slider.dataset.capMax);
      const unit = slider.dataset.capUnit || "";
      const lbl = val >= max ? "全部" : (Math.abs(val) >= 10000 ? `${(val/1000).toFixed(0)}k` : `${Number(val.toFixed(1))}${unit}`);
      const labelEl = slider.closest(".scatter-slider-row")?.querySelector(".scatter-y-lbl");
      if (labelEl) labelEl.textContent = lbl;
    });
    slider.addEventListener("change", () => {
      const val = Number(slider.value);
      const max = Number(slider.dataset.capMax);
      state[slider.dataset.scatterCapKey] = val >= max ? null : val;
      renderCloudSnapshot();
    });
  });
  // X 軸天數滑軸：input 即時更新標籤，change 重繪圖表
  els.cloudSnapshot.querySelectorAll(".scatter-x-slider").forEach((slider) => {
    slider.addEventListener("input", () => {
      const val = Number(slider.value);
      const max = Number(slider.dataset.daysMax);
      const labelEl = slider.closest(".scatter-slider-row")?.querySelector(".scatter-x-lbl");
      if (labelEl) labelEl.textContent = val >= max ? "全部" : val;
    });
    slider.addEventListener("change", () => {
      const val = Number(slider.value);
      state[slider.dataset.scatterDaysKey] = val >= Number(slider.dataset.daysMax) ? null : val;
      renderCloudSnapshot();
    });
  });
  // 散點圖參考線：綁在各 <g data-scatter-ref> 上（避免 renderCloudSnapshot 重複累積 listener）
  els.cloudSnapshot.querySelectorAll("[data-scatter-ref]").forEach((grp) => {
    grp.addEventListener("click", (e) => {
      e.stopPropagation();
      const refKey = grp.dataset.refKey;
      const symbol = grp.dataset.refSymbol;
      const svg = grp.closest("svg");
      if (!svg) return;
      const refLayer = svg.querySelector(`.scatter-ref-layer[data-ref-key="${refKey}"]`);
      if (!refLayer) return;
      const allGrps = [...svg.querySelectorAll(`[data-scatter-ref][data-ref-key="${refKey}"]`)];
      if (refLayer.dataset.activeSymbol === symbol) {
        // 再次點擊同一點 → 清除，還原所有點原始顏色
        refLayer.innerHTML = "";
        refLayer.dataset.activeSymbol = "";
        allGrps.forEach((g) => {
          const c = g.querySelector("circle");
          if (!c) return;
          c.setAttribute("fill", g.dataset.refOrigColor || "var(--green)");
          c.removeAttribute("stroke"); c.removeAttribute("stroke-width");
          c.setAttribute("opacity", "0.85");
        });
        return;
      }
      const refSlope = parseFloat(grp.dataset.refSlope);
      // 依基準線斜率為所有點著色
      allGrps.forEach((g) => {
        const c = g.querySelector("circle");
        if (!c) return;
        if (g.dataset.refSymbol === symbol) {
          c.setAttribute("fill", g.dataset.refOrigColor || "var(--green)");
          c.setAttribute("stroke", "var(--text)");
          c.setAttribute("stroke-width", "2");
          c.setAttribute("opacity", "1");
        } else {
          c.removeAttribute("stroke"); c.removeAttribute("stroke-width");
          const dx = parseFloat(g.dataset.refDotX), dy = parseFloat(g.dataset.refDotY);
          c.setAttribute("fill", dy >= refSlope * dx ? "var(--green)" : "var(--red)");
          c.setAttribute("opacity", "0.9");
        }
      });
      // 畫參考虛線（裁切到圖表區域）並標示代號
      const x1 = grp.dataset.refX1, y1 = grp.dataset.refY1;
      const x2 = grp.dataset.refX2, y2 = grp.dataset.refY2;
      const ptNum = parseFloat(grp.dataset.refPt);
      const pbNum = parseFloat(grp.dataset.refHpb);
      const ly = Math.max(ptNum + 10, Math.min(pbNum - 4, parseFloat(y2)));
      refLayer.dataset.activeSymbol = symbol;
      refLayer.innerHTML = `
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
              stroke="#999" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.8"
              clip-path="url(#scatter-ref-clip-${refKey})"/>
        <text x="${parseFloat(x2) - 4}" y="${ly}" text-anchor="end" font-size="9" font-weight="600"
              fill="var(--muted)" paint-order="stroke" stroke="var(--bg)" stroke-width="2.5">${escapeHtml(symbol)}</text>`;
    });
  });
  els.cloudSnapshot.querySelectorAll("[data-symbol-row]").forEach((row) => {
    row.addEventListener("click", () => {
      const symbol = row.dataset.symbolRow;
      const name = row.dataset.symbolName || symbol;
      const display = els.cloudSnapshot.querySelector("#symbol-chart-display");
      const content = els.cloudSnapshot.querySelector("#symbol-chart-content");
      if (!display || !content) return;
      const chartHtml = renderSymbolSharesChart(symbol, state.cloudHistory);
      content.innerHTML = chartHtml
        ? `<div class="symbol-chart-heading"><strong>${escapeHtml(symbol)}</strong> ${escapeHtml(name)} 走勢</div>${chartHtml}`
        : `<p class="muted-text">${escapeHtml(symbol)} 尚無歷史資料。</p>`;
      display.style.display = "block";
    });
  });
  els.cloudSnapshot.querySelectorAll(".batch-firstbuy-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const market = btn.dataset.market;
      state.batchFirstBuyMode = { ...state.batchFirstBuyMode, [market]: !state.batchFirstBuyMode[market] };
      renderCloudSnapshot();
    });
  });
  els.cloudSnapshot.querySelectorAll(".batch-firstbuy-save-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const market = btn.dataset.market;
      const panel = btn.closest(".batch-firstbuy-panel");
      const inputs = panel.querySelectorAll(".batch-firstbuy-input");
      const toSave = [...inputs].filter((i) => i.value);
      if (!toSave.length) { alert("請至少填入一個日期"); return; }
      btn.disabled = true;
      btn.textContent = "儲存中…";
      for (const input of toSave) {
        await saveFirstBuyDate(input.dataset.market, input.dataset.symbol, input.value);
      }
      state.batchFirstBuyMode = { ...state.batchFirstBuyMode, [market]: false };
      renderCloudSnapshot();
    });
  });
  els.cloudSnapshot.querySelectorAll(".first-buy-set-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const input = btn.closest("td")?.querySelector(".first-buy-input");
      if (!input?.value) { alert("請選擇日期"); return; }
      await saveFirstBuyDate(btn.dataset.market, btn.dataset.symbol, input.value);
      renderCloudSnapshot();
    });
  });
  els.cloudSnapshot.querySelectorAll(".first-buy-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cell = btn.closest("td");
      if (!cell) return;
      const { market, symbol, current } = btn.dataset;
      cell.innerHTML = `
        <input type="date" class="first-buy-input cell-input" value="${escapeHtml(current)}" data-market="${escapeHtml(market)}" data-symbol="${escapeHtml(symbol)}">
        <button class="button compact first-buy-confirm-btn" data-market="${escapeHtml(market)}" data-symbol="${escapeHtml(symbol)}">確認</button>
        <button class="button compact secondary first-buy-cancel-btn">取消</button>
      `;
      cell.querySelector(".first-buy-confirm-btn").addEventListener("click", async () => {
        const newDate = cell.querySelector(".first-buy-input").value;
        if (!newDate) { alert("請選擇日期"); return; }
        await saveFirstBuyDate(market, symbol, newDate);
        renderCloudSnapshot();
      });
      cell.querySelector(".first-buy-cancel-btn").addEventListener("click", () => {
        renderCloudSnapshot();
      });
    });
  });
  els.cloudSnapshot.querySelectorAll(".sortable-th[data-sort-key]").forEach((th) => {
    th.style.cursor = "pointer";
    th.addEventListener("click", (e) => {
      if (e.target.closest(".detail-edit-toggle")) return; // 筆按鈕點擊不觸發排序
      const key = th.dataset.sortKey;
      if (state.detailSort.key === key) {
        state.detailSort.dir = state.detailSort.dir === "asc" ? "desc" : "asc";
      } else {
        state.detailSort = { key, dir: "asc" };
      }
      renderCloudSnapshot();
    });
  });
  // B tab：日期選擇器
  els.cloudSnapshot.querySelector("#holdings-date-select")?.addEventListener("change", (e) => {
    state.selectedSnapshotDate = e.target.value;
    renderCloudSnapshot();
  });
  // B tab：查看截圖連結
  els.cloudSnapshot.querySelector("#view-entry-btn")?.addEventListener("click", (e) => {
    const id = e.currentTarget.dataset.entryId;
    if (id) openDetail(id);
  });
  // B tab：修正 Sheet 代號
  els.cloudSnapshot.querySelector("#fix-symbols-btn")?.addEventListener("click", () => fixSheetSymbols());
  // B tab：清除廢棄倉位
  els.cloudSnapshot.querySelector("#cleanup-zero-btn")?.addEventListener("click", () => cleanupZeroPositions());
  // B tab：重建布局歷史
  els.cloudSnapshot.querySelector("#rebuild-layout-btn")?.addEventListener("click", () => rebuildLayoutHistory());
  // 筆按鈕：切換 edit mode
  els.cloudSnapshot.querySelectorAll(".detail-edit-toggle").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const market = btn.dataset.editMarket;
      state.detailEditMode[market] = !state.detailEditMode[market];
      renderCloudSnapshot();
    });
  });
  // edit mode 每行儲存按鈕（股數 + 均價）
  els.cloudSnapshot.querySelectorAll(".edit-row-save-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const { market, symbol } = btn.dataset;
      const tr = btn.closest("tr");
      const shares = Number(tr?.querySelector(".edit-shares-input")?.value) || 0;
      const avgCost = Number(tr?.querySelector(".edit-avgcost-input")?.value) || 0;
      btn.disabled = true;
      btn.textContent = "儲存中…";
      await savePositionEdits(market, symbol, shares, avgCost);
      btn.disabled = false;
      btn.textContent = "儲存";
    });
  });
  // C tab 已儲存截圖列表
  els.cloudSnapshot.querySelectorAll(".capture-entry-row").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.dataset.entryId;
      if (id) openDetail(id);
    });
  });
  // C tab 批量清除舊截圖
  els.cloudSnapshot.querySelector("#bulk-clear-old")?.addEventListener("click", () => bulkClearOldEntries());
  renderSummaryLine();
}

function bindSwipeDeleteRows(root) {
  root?.querySelectorAll(".swipe-row").forEach((row) => {
    let startX = 0;
    let currentX = 0;
    let dragging = false;
    const content = row.querySelector(".swipe-row-content");
    if (!content) return;

    const setOffset = (offset) => {
      const value = Math.max(-92, Math.min(0, offset));
      content.style.transform = `translateX(${value}px)`;
      row.classList.toggle("is-open", value < -44);
    };

    row.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      dragging = true;
      startX = event.clientX;
      currentX = row.classList.contains("is-open") ? -92 : 0;
      content.style.transition = "none";
      row.setPointerCapture?.(event.pointerId);
    });

    row.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      setOffset(currentX + event.clientX - startX);
    });

    row.addEventListener("pointerup", (event) => {
      if (!dragging) return;
      dragging = false;
      content.style.transition = "";
      const delta = event.clientX - startX;
      setOffset(delta < -42 || (row.classList.contains("is-open") && delta < 24) ? -92 : 0);
    });

    row.addEventListener("pointercancel", () => {
      dragging = false;
      content.style.transition = "";
      setOffset(row.classList.contains("is-open") ? -92 : 0);
    });
  });
}

async function deleteCloudSnapshotById(snapshotId, button) {
  if (!snapshotId) return;
  if (button) {
    button.disabled = true;
    button.textContent = "檢查";
  }
  try {
    await ensureCloudSheetTables();
    const snapshotValues = await readCloudSheetValues(SHEET_NAMES.snapshots, "A2:H");
    const positionValues = await readCloudSheetValues(SHEET_NAMES.positions, "A2:J");
    const snapshots = parseSnapshotRows(stripHeaderRow(snapshotValues, SHEET_HEADERS.snapshots));
    const positions = parsePositionRows(stripHeaderRow(positionValues, SHEET_HEADERS.positions));
    const target = snapshots.find((snapshot) => snapshot.snapshotId === snapshotId);
    if (!target) {
      alert("這筆快照已不存在，將重新整理。");
      await loadLatestCloudSnapshot(false);
      return;
    }
    const positionCount = positions.filter((row) => row.snapshotId === snapshotId).length;
    const confirmed = confirm([
      `確定刪除 ${target.date} ${marketLabel(target.market)} 快照？`,
      "",
      `${target.rowCount || positionCount} 檔庫存 · ${target.createdAt}`,
      "",
      "刪除後會同步移除這筆快照的庫存明細。",
    ].join("\n"));
    if (!confirmed) return;

    if (button) button.textContent = "刪除";
    const keptSnapshots = snapshots.filter((snapshot) => snapshot.snapshotId !== snapshotId);
    const keptPositions = positions.filter((row) => row.snapshotId !== snapshotId);

    await clearSheetValues(SHEET_NAMES.snapshots, "A2:H");
    await clearSheetValues(SHEET_NAMES.positions, "A2:J");
    if (keptSnapshots.length) {
      await updateSheetValues(SHEET_NAMES.snapshots, "A2:H", keptSnapshots.map(snapshotToSheetRow));
    }
    if (keptPositions.length) {
      await updateSheetValues(SHEET_NAMES.positions, "A2:J", keptPositions.map(positionToSheetRow));
    }

    await loadLatestCloudSnapshot(false);
    alert("已刪除雲端快照。");
  } catch (error) {
    console.error(error);
    alert(error.message || "刪除雲端快照失敗");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "刪除";
    }
  }
}

async function deleteSelectedCloudSnapshots({ buttonId = "delete-cloud-snapshot", dateId = "delete-snapshot-date", marketId = "delete-snapshot-market" } = {}) {
  const button = els.cloudSnapshot?.querySelector(`#${buttonId}`);
  const dateInput = els.cloudSnapshot?.querySelector(`#${dateId}`);
  const marketInput = els.cloudSnapshot?.querySelector(`#${marketId}`);
  const date = normalizeDateText(dateInput?.value);
  const market = normalizeMarketKey(marketInput?.value);

  if (!date) {
    alert("請先選擇要刪除的日期。");
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "檢查中...";
  }
  try {
    await ensureCloudSheetTables();
    const snapshotValues = await readCloudSheetValues(SHEET_NAMES.snapshots, "A2:H");
    const positionValues = await readCloudSheetValues(SHEET_NAMES.positions, "A2:J");
    const snapshots = parseSnapshotRows(stripHeaderRow(snapshotValues, SHEET_HEADERS.snapshots));
    const positions = parsePositionRows(stripHeaderRow(positionValues, SHEET_HEADERS.positions));
    const targets = snapshotsForDeletion(snapshots, date, market);
    const targetIds = new Set(targets.map((snapshot) => snapshot.snapshotId));
    const targetPositionCount = positions.filter((row) => targetIds.has(row.snapshotId)).length;

    if (!targets.length) {
      alert("這個日期與市場沒有雲端快照。");
      return;
    }

    const targetLines = targets
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((snapshot) => `- ${snapshot.date} ${marketLabel(snapshot.market)} · ${snapshot.rowCount || 0} 檔 · ${snapshot.createdAt}`)
      .join("\n");
    const confirmed = confirm([
      `確定刪除 ${targets.length} 筆快照與 ${targetPositionCount} 筆庫存明細？`,
      "",
      targetLines,
      "",
      "刪除後會直接重寫 Google Sheet 的雲端快照資料。",
    ].join("\n"));
    if (!confirmed) return;

    if (button) button.textContent = "刪除中...";
    const keptSnapshots = snapshots.filter((snapshot) => !targetIds.has(snapshot.snapshotId));
    const keptPositions = positions.filter((row) => !targetIds.has(row.snapshotId));

    await clearSheetValues(SHEET_NAMES.snapshots, "A2:H");
    await clearSheetValues(SHEET_NAMES.positions, "A2:J");
    if (keptSnapshots.length) {
      await updateSheetValues(SHEET_NAMES.snapshots, "A2:H", keptSnapshots.map(snapshotToSheetRow));
    }
    if (keptPositions.length) {
      await updateSheetValues(SHEET_NAMES.positions, "A2:J", keptPositions.map(positionToSheetRow));
    }

    await loadLatestCloudSnapshot(false);
    alert(`已刪除 ${targets.length} 筆雲端快照。`);
  } catch (error) {
    console.error(error);
    alert(error.message || "刪除雲端快照失敗");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "刪除快照";
    }
  }
}

async function cleanupDuplicateCloudSnapshots() {
  const button = els.cloudSnapshot?.querySelector("#cleanup-duplicates");
  if (button) {
    button.disabled = true;
    button.textContent = "檢查中...";
  }
  try {
    await ensureCloudSheetTables();
    const snapshotValues = await readCloudSheetValues(SHEET_NAMES.snapshots, "A2:H");
    const positionValues = await readCloudSheetValues(SHEET_NAMES.positions, "A2:J");
    const snapshots = parseSnapshotRows(stripHeaderRow(snapshotValues, SHEET_HEADERS.snapshots));
    const positions = parsePositionRows(stripHeaderRow(positionValues, SHEET_HEADERS.positions));
    const duplicateGroups = findDuplicateSnapshotGroups(snapshots, positions);
    const duplicateIds = new Set(duplicateGroups.flatMap((group) => group.slice(1).map((item) => item.snapshot.snapshotId)));

    if (!duplicateIds.size) {
      alert("沒有找到同日、同市場、同內容的重複快照。");
      return;
    }

    const confirmed = confirm(`找到 ${duplicateGroups.length} 組重複快照，將刪除 ${duplicateIds.size} 筆較舊快照與其庫存明細，保留每組最新建立的一份。確定清理？`);
    if (!confirmed) return;

    if (button) button.textContent = "清理中...";
    const keptSnapshots = snapshots.filter((snapshot) => !duplicateIds.has(snapshot.snapshotId));
    const keptPositions = positions.filter((row) => !duplicateIds.has(row.snapshotId));

    await clearSheetValues(SHEET_NAMES.snapshots, "A2:H");
    await clearSheetValues(SHEET_NAMES.positions, "A2:J");
    if (keptSnapshots.length) {
      await updateSheetValues(SHEET_NAMES.snapshots, "A2:H", keptSnapshots.map(snapshotToSheetRow));
    }
    if (keptPositions.length) {
      await updateSheetValues(SHEET_NAMES.positions, "A2:J", keptPositions.map(positionToSheetRow));
    }

    await loadLatestCloudSnapshot(false);
    alert(`已清理 ${duplicateIds.size} 筆重複快照。`);
  } catch (error) {
    console.error(error);
    alert(error.message || "清理重複快照失敗");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "清理重複";
    }
  }
}

function exportBackup() {
  const payload = JSON.stringify({
    app: "AssetFlow Invest",
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: state.entries,
  }, null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `assetflow-invest-backup-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function exportEntryDiagnostics(id) {
  const entry = state.entries.find((item) => item.id === id);
  const image = entry?.images?.[0];
  if (!entry || !image?.dataUrl) return;

  const button = els.detailContent.querySelector('[data-action="export-diagnostics"]');
  if (button) {
    button.disabled = true;
    button.textContent = "診斷中...";
  }

  try {
    const prepared = await prepareImageForOcr(image, {
      maskEditButtons: entry.kind === "ark_position",
    });
    const dimensions = await imageDimensions(prepared.dataUrl);
    const loadedImage = await loadImage(prepared.dataUrl);
    const separators = await detectArkRowSeparators(loadedImage);
    const left = 0.095;
    const right = 0.965;
    const minHeight = dimensions.height * 0.052;
    const maxHeight = dimensions.height * 0.145;
    const detectedRects = rectsFromSeparators(separators, dimensions.width, dimensions.height, left, right, minHeight, maxHeight);
    const fallbackRects = fallbackArkRowRects(dimensions.width, dimensions.height, left, right);
    const activeRects = detectedRects.length ? detectedRects : fallbackRects;
    const activeSource = detectedRects.length ? "separator" : "fallback";
    const activeCrops = [];

    for (let index = 0; index < activeRects.length; index += 1) {
      const rect = activeRects[index];
      activeCrops.push({
        index: index + 1,
        source: rect.fallback ? "fallback" : "separator",
        rect: serializeRect(rect, dimensions),
        dataUrl: await cropImageDataUrl(prepared.dataUrl, rect),
      });
    }

    const payload = {
      app: "AssetFlow Invest",
      appVersion: APP_VERSION,
      diagnosticVersion: 1,
      exportedAt: new Date().toISOString(),
      entry: {
        id: entry.id,
        title: entry.title,
        date: entry.date,
        kind: entry.kind,
        market: entry.market,
        imageName: image.name,
        imageType: image.type,
        convertedFrom: prepared.convertedFrom || "",
        maskedForOcr: Boolean(prepared.maskedForOcr),
      },
      image: {
        width: dimensions.width,
        height: dimensions.height,
        processedDataUrl: prepared.dataUrl,
      },
      detection: {
        separators,
        detectedRectCount: detectedRects.length,
        fallbackRectCount: fallbackRects.length,
        activeSource,
        activeRectCount: activeRects.length,
        detectedRects: detectedRects.map((rect) => serializeRect(rect, dimensions)),
        fallbackRects: fallbackRects.map((rect) => serializeRect(rect, dimensions)),
        activeCrops,
      },
      savedParseState: {
        parsedRows: entry.parsedRows || [],
        rowCrops: entry.rowCrops || [],
        skippedRowCrops: entry.skippedRowCrops || [],
      },
    };

    downloadJson(payload, `assetflow-invest-diagnostics-${entry.id}-${today()}.json`);
  } catch (error) {
    console.error(error);
    alert(error.message || "診斷匯出失敗，請重新整理後再試");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "匯出診斷";
    }
  }
}

function serializeRect(rect, dimensions) {
  const x = Math.round(dimensions.width * rect.x);
  const y = Math.round(dimensions.height * rect.y);
  const width = Math.round(dimensions.width * rect.width);
  const height = Math.round(dimensions.height * rect.height);
  return {
    x,
    y,
    width,
    height,
    top: rect.top ?? y,
    bottom: rect.bottom ?? (y + height),
    fallback: Boolean(rect.fallback),
    relative: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
  };
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackup(file) {
  if (!file) return;
  const text = await file.text();
  const parsed = JSON.parse(text);
  const entries = Array.isArray(parsed) ? parsed : parsed.entries;
  if (!Array.isArray(entries)) {
    alert("備份格式不正確");
    return;
  }
  const normalized = entries
    .filter((entry) => entry && entry.id && Array.isArray(entry.images))
    .map((entry) => ({
      ...entry,
      updatedAt: new Date().toISOString(),
    }));
  if (!normalized.length) {
    alert("備份內沒有可匯入資料");
    return;
  }
  await txStore("readwrite", (store) => {
    normalized.forEach((entry) => store.put(entry));
  });
  state.entries = await getAllEntries();
  render();
  alert(`已匯入 ${normalized.length} 筆`);
}

function bindEvents() {
  els.fileInput.addEventListener("change", (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  });
  els.backupInput.addEventListener("change", (event) => importBackup(event.target.files[0]));
  els.openCapture?.addEventListener("click", openCapturePanel);
  els.closeCapture?.addEventListener("click", closeCapturePanel);
  els.capturePanel?.addEventListener("click", (e) => {
    if (e.target.matches("[data-dismiss-skipped]")) {
      e.target.closest(".skipped-row-item")?.remove();
    }
    if (e.target.matches("[data-add-skipped]")) {
      const item = e.target.closest(".skipped-row-item");
      if (!item) return;
      const symbol = (item.querySelector("[data-skipped-symbol]")?.value || "").trim().toUpperCase();
      const name = (item.querySelector("[data-skipped-name]")?.value || "").trim();
      const shares = parseFloat(item.querySelector("[data-skipped-shares]")?.value || "");
      const avgCost = parseFloat(item.querySelector("[data-skipped-avgcost]")?.value || "");
      if (!symbol) { alert("請填入代號"); return; }
      if (!Number.isFinite(shares) || shares <= 0) { alert("請填入有效股數"); return; }
      if (!state.draftEditedRows) state.draftEditedRows = [];
      state.draftEditedRows.push({ symbol, name: name || SYMBOL_NAMES[symbol] || "", shares, avgCost: Number.isFinite(avgCost) ? avgCost : 0 });
      const newIndex = state.draftEditedRows.length - 1;
      if (els.save) els.save.disabled = false; // OCR 後 skipped row 加入也啟用 save
      const tbody = els.parsePreview?.querySelector(".parsed-table tbody");
      if (tbody) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td></td>
          <td><input class="cell-input" data-draft-symbol="${newIndex}" type="text" value="${escapeHtml(symbol)}" placeholder="代號"></td>
          <td><input class="cell-input" data-draft-name="${newIndex}" type="text" value="${escapeHtml(name)}" placeholder="名稱"></td>
          <td><input class="cell-input" data-draft-kind="${newIndex}" type="text" value="" placeholder="種類"></td>
          <td><input class="cell-input" data-draft-shares="${newIndex}" type="number" step="0.001" value="${shares}"></td>
          <td><input class="cell-input" data-draft-avgcost="${newIndex}" type="number" step="0.001" value="${Number.isFinite(avgCost) ? avgCost : ""}"></td>
          <td></td>
          <td class="raw-cell"></td>
        `;
        tr.querySelector("[data-draft-symbol]")?.addEventListener("input", (ev) => {
          if (state.draftEditedRows?.[newIndex]) state.draftEditedRows[newIndex].symbol = ev.target.value.trim().toUpperCase();
        });
        tr.querySelector("[data-draft-name]")?.addEventListener("input", (ev) => {
          if (state.draftEditedRows?.[newIndex]) state.draftEditedRows[newIndex].name = ev.target.value.trim();
        });
        tr.querySelector("[data-draft-shares]")?.addEventListener("input", (ev) => {
          if (state.draftEditedRows?.[newIndex]) state.draftEditedRows[newIndex].shares = Number(ev.target.value) || 0;
        });
        tr.querySelector("[data-draft-avgcost]")?.addEventListener("input", (ev) => {
          if (state.draftEditedRows?.[newIndex]) state.draftEditedRows[newIndex].avgCost = Number(ev.target.value) || 0;
        });
        tbody.appendChild(tr);
      }
      item.remove();
    }
  });
  els.dropZone.addEventListener("click", () => els.fileInput.click());
  els.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.dropZone.classList.add("is-over");
  });
  els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("is-over"));
  els.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("is-over");
    addFiles(event.dataTransfer.files);
  });
  document.addEventListener("paste", (event) => {
    const files = [...event.clipboardData.files].filter((file) => file.type.startsWith("image/"));
    if (files.length) {
      openCapturePanel();
      addFiles(files);
    }
  });
  els.form.addEventListener("submit", saveEntry);
  els.clear.addEventListener("click", clearDraft);
  els.parseDraft.addEventListener("click", parseDraftImages);
  els.search?.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });
  els.exportBackup.addEventListener("click", exportBackup);
  els.syncLatest.addEventListener("click", () => loadLatestCloudSnapshot(true));
  els.saveMergedSnapshot?.addEventListener("click", saveMergedSnapshotToGoogleSheet);
  els.authSignIn?.addEventListener("click", signInAndLoadApp);
  els.authSettings?.addEventListener("click", () => {
    configureSheetSync();
    renderAuthGate();
  });
  els.closeDetail.addEventListener("click", closeDetail);
  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segment").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      state.filter = button.dataset.filter;
      render();
    });
  });
}

let appDataLoaded = false;
let authFlowInProgress = false;

async function signInAndLoadApp() {
  authFlowInProgress = true;
  if (els.authSignIn) {
    els.authSignIn.disabled = true;
    els.authSignIn.textContent = "登入中...";
  }
  try {
    await getGoogleAccessToken();
    setAppLocked(false);
    if (!appDataLoaded) {
      state.entries = await getAllEntries();
      appDataLoaded = true;
    }
    renderCloudSnapshot();
    render();
    await loadLatestCloudSnapshot(false);
  } catch (error) {
    console.error(error);
    resetGoogleSession(error.message || "Google 登入失敗");
  } finally {
    authFlowInProgress = false;
    renderAuthGate();
  }
}

async function init() {
  const versionText = `AssetFlow Invest ${APP_VERSION} · ${APP_VERSION_NOTE}`;
  if (els.appVersion) els.appVersion.textContent = versionText;
  const authVersion = document.getElementById("auth-version");
  if (authVersion) authVersion.textContent = versionText;
  els.date.value = today();
  bindEvents();
  registerServiceWorker();
  setAppLocked(true);
  renderAuthGate();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    if (authFlowInProgress) return;
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.register("./sw.js").then((registration) => {
    swRegistration = registration;
    registration.update?.();
  }).catch((error) => console.warn("service worker", error));
}

init().catch((error) => {
  console.error(error);
  alert("AssetFlow Invest 啟動失敗");
});
