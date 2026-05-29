const DB_NAME = "assetflow_invest_screenshots";
const DB_VERSION = 1;
const STORE = "entries";
const APP_VERSION = "v0.14.4";
const APP_VERSION_NOTE = "蝘駁瘞港? tab 靘?嚗耨甇?偌雿隅?Ｙ撣賊?";
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
  levels: "瘞港?",
  layout: "AssetFlowLayout",
};
const SHEET_HEADERS = {
  snapshots: ["snapshot_id", "created_at", "date", "market", "source_entry_id", "source_title", "row_count", "app_version"],
  positions: ["snapshot_id", "date", "market", "symbol", "name", "kind", "shares", "avg_cost", "source", "created_at"],
  layout: ["date", "market", "symbol", "name", "shares", "prev_shares", "delta"],
};
const SYMBOL_NAMES = {
  "0050": "?之?啁50",
  "0051": "?之銝剖?100",
  "0052": "撖蝘?",
  "0053": "?之?餃?",
  "00830": "?陸鞎餃???擃?,
  "00861": "?之?函??芯???",
  "00876": "?之?函?5G",
  "00893": "?陸?箄?餃?頠?,
  "00909": "?陸?訾??臭???",
  "00910": "蝚砌??云蝛箄???,
  "00911": "??瘣脤???擃?,
  "00920": "撖ESG蝬?餃?",
  "00941": "銝凋縑銝虜??擃?,
  "00988A": "銝餃?蝯曹??函??菜",
  "2327": "?楊",
  "2330": "?啁???,
};

const state = {
  entries: [],
  draftImages: [],
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
  targetLevels: loadTargetLevels(),
  targetLevelHistory: [],
  quotes: {},
  auth: {
    signedIn: false,
    authorized: false,
    email: "",
    message: "隢蝙?冽?甈? Google 撣唾??餃??,
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
  status: $("#entry-status"),
  title: $("#entry-title"),
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
    heicLoadPromise = loadScript(HEIC_SCRIPT_URL, () => Boolean(window.heic2any), "HEIC 頧?璅∠?");
  }
  await heicLoadPromise;
  if (!window.heic2any) {
    throw new Error("HEIC 頧?璅∠?頛敺?銝?剁?隢??唳???岫");
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
  els.save.disabled = state.draftImages.length === 0;
  els.parseDraft.disabled = state.draftImages.length === 0;
  els.draftPreview.innerHTML = state.draftImages.map((image) => `
    <div class="draft-shot">
      <img src="${image.dataUrl}" alt="">
      <span>${escapeHtml(image.name)}</span>
    </div>
  `).join("");
  if (state.draftImages.length > 0 && !els.title.value.trim()) {
    els.title.value = state.draftImages.length === 1
      ? state.draftImages[0].name.replace(/\.[^.]+$/, "")
      : `${state.draftImages.length} 撘菜?;
  }
  if (!state.draftImages.length) {
    els.ocrStatus.textContent = "撠閫??";
    els.parsePreview.innerHTML = "";
  }
}

function kindLabel(kind) {
  return {
    ark_position: "?寡?摨怠?",
    ark_level: "?寡?瘞港?",
    ark_layout: "?寡?撣?",
    broker_position: "?詨?摨怠?",
    other: "?嗡?",
  }[kind] || kind;
}

function statusLabel(status) {
  return {
    new: "?芣??,
    reviewed: "撌脩Ⅱ隤?,
    imported: "撌脣??,
  }[status] || status;
}

function marketLabel(market) {
  return { TW: "?啗", US: "蝢", ALL: "?券" }[market] || market;
}

function normalizeMarketKey(market) {
  const value = String(market || "").trim().toUpperCase();
  if (["TW", "?啗", "TAIWAN", "TPE", "TSE"].includes(value)) return "TW";
  if (["US", "蝢", "USA", "NYSE", "NASDAQ"].includes(value)) return "US";
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
    alert("撣撱箄降瘞港?隢撓??0 ??100 ???");
    return false;
  }
  state.targetLevels[key] = number;
  saveTargetLevels();
  saveTargetLevelToSheet(key, number);
  return true;
}

async function saveTargetLevelToSheet(market, level) {
  if (!googleAccessToken || !state.auth.authorized) return;
  try {
    const tabName = market === "TW" ? "?啗" : "蝢";
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
      { date: todayStr, market, targetLevel: level, source: "瘞港?" },
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
    .replace(/[嚗?_-]/g, "");
}

function findHeaderIndex(headers, candidates) {
  const normalized = headers.map(normalizeHeaderText);
  return normalized.findIndex((header) => candidates.some((candidate) => header.includes(normalizeHeaderText(candidate))));
}

function findTargetLevelIndex(headers) {
  const preferred = findHeaderIndex(headers, ["?寡?撱箄降瘞港?", "撱箄降瘞港?", "?格?瘞港?", "撱箄降%", "targetlevel", "target"]);
  return preferred >= 0 ? preferred : findHeaderIndex(headers, ["瘞港?"]);
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
  const text = String(value ?? "").replace("嚗?, "%").trim();
  const number = Number(text.replace("%", "").replace(/,/g, ""));
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
}

function looksLikePercent(value) {
  const text = String(value ?? "").replace("嚗?, "%").trim();
  return text.includes("%") || (parsePercentValue(text) !== null && !isTwSymbol(text));
}

function marketFromText(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "";
  if (/(^|[^A-Z])TW([^A-Z]|$)|?啗|?箄|?啁|?箇/.test(text)) return "TW";
  if (/(^|[^A-Z])US([^A-Z]|$)|蝢|蝢?/.test(text)) return "US";
  return "";
}

async function loadTargetLevelHistory() {
  try {
    const [twValues, usValues] = await Promise.all([
      readSheetValues("?啗", "A:B").catch(() => []),
      readSheetValues("蝢", "A:B").catch(() => []),
    ]);
    const fromTw = twValues
      .filter((row, i) => i > 0 && row[0] && row[1])
      .map((row) => ({ date: normalizeDateText(row[0]), market: "TW", targetLevel: parsePercentValue(row[1]), source: "?啗" }))
      .filter((item) => item.date && item.targetLevel !== null);
    const fromUs = usValues
      .filter((row, i) => i > 0 && row[0] && row[1])
      .map((row) => ({ date: normalizeDateText(row[0]), market: "US", targetLevel: parsePercentValue(row[1]), source: "蝢" }))
      .filter((item) => item.date && item.targetLevel !== null);
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
        <h3>${escapeHtml(entry.title || "?芸???)}</h3>
        <p>${escapeHtml(parsedCount ? `${entry.date} 繚 ${parsedCount} 蝑澈摮?? : entry.text || entry.note || entry.date)}</p>
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
    els.summary.textContent = `${date || "???} 繚 ${positions.length} 瑼澈摮?繚 ${state.entries.length} 撘萄翰?呎;
    return;
  }
  els.summary.textContent = state.auth.authorized
    ? `撠霈?圈蝡臬澈摮?繚 ${state.entries.length} 撘萄翰?呎
    : "?餃敺???仿蝡臬澈摮?;
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
  if (!state.draftImages.length) return;

  const base = {
    id: entryId(),
    date: els.date.value || today(),
    market: els.market.value,
    kind: els.kind.value,
    status: els.status.value,
    title: els.title.value.trim(),
    text: els.text.value.trim(),
    note: els.note.value.trim(),
    parsedRows: parseHoldings(els.text.value.trim()),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const entries = state.draftImages.map((image, index) => ({
    ...base,
    id: index === 0 ? base.id : entryId(),
    title: state.draftImages.length === 1
      ? base.title
      : `${base.title || "?芸?"} ${index + 1}`,
    images: [image],
    parsedRows: image.parsedRows || base.parsedRows,
    ocrElapsedMs: image.ocrElapsedMs,
    columnOcrMs: image.columnOcrMs,
    rowOcrMs: image.rowOcrMs,
    columnCrops: image.columnCrops || [],
    rowCrops: image.rowCrops || [],
    skippedRowCrops: image.skippedRowCrops || [],
    completeCircleCount: image.completeCircleCount || 0,
    missingRowCount: image.missingRowCount || 0,
  }));

  await txStore("readwrite", (store) => {
    entries.forEach((entry) => store.put(entry));
  });

  state.entries.push(...entries);
  clearDraft();
  closeCapturePanel();
  render();
}

function clearDraft() {
  state.draftImages = [];
  els.form.reset();
  els.date.value = today();
  els.save.disabled = true;
  els.parseDraft.disabled = true;
  els.draftPreview.innerHTML = "";
  els.parsePreview.innerHTML = "";
  els.ocrStatus.textContent = "撠閫??";
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
      <h2>${escapeHtml(entry.title || "?芸???)}</h2>
      <div class="form-actions detail-actions">
        <button class="button secondary" type="button" data-action="parse-entry">?閫???芸?</button>
        <button class="button secondary" type="button" data-action="export-diagnostics">?臬閮箸</button>
        <button class="button secondary" type="button" data-action="mark-reviewed">璅?撌脩Ⅱ隤?/button>
        <button class="button secondary" type="button" data-action="mark-imported">璅?撌脣??/button>
        <button class="button primary" type="button" data-action="save-cloud-snapshot">摮 Google Sheet</button>
        <button class="button ghost danger" type="button" data-action="delete">?芷</button>
      </div>
      ${renderOcrCompleteness(entry.expectedTotalCount || entry.completeCircleCount || 0, (entry.parsedRows || []).length || parseHoldings(entry.text || "").length, entry.missingRowCount || 0, "detail", entry.expectedTotalCount ? "total" : "circle")}
      ${renderParsedRows(entry.parsedRows || parseHoldings(entry.text || ""), "detail", id, entry.columnCrops || [], entry.rowCrops || [], entry.skippedRowCrops || [])}
      <div class="detail-grid">
        <div class="detail-field"><span>撱箇???</span><strong>${new Date(entry.createdAt).toLocaleString()}</strong></div>
        <div class="detail-field"><span>瑼?</span><strong>${escapeHtml(entry.images[0]?.name || "")}</strong></div>
        ${renderOcrTiming(entry)}
      </div>
      <div class="detail-field ocr-text-field">
        <span>?瑕??? / ??鋆???/span>
        <div class="pre-wrap">${escapeHtml(entry.text || "撠憛怠神")}</div>
      </div>
      <div class="detail-field">
        <span>?酉</span>
        <div class="pre-wrap">${escapeHtml(entry.note || "撠憛怠神")}</div>
      </div>
    </div>
  `;
  els.detail.classList.add("is-open");

  els.detailContent.querySelector('[data-action="parse-entry"]').addEventListener("click", () => parseExistingEntry(id));
  els.detailContent.querySelector('[data-action="export-diagnostics"]').addEventListener("click", () => exportEntryDiagnostics(id));
  els.detailContent.querySelector('[data-action="mark-reviewed"]').addEventListener("click", () => updateStatus(id, "reviewed"));
  els.detailContent.querySelector('[data-action="mark-imported"]').addEventListener("click", () => updateStatus(id, "imported"));
  els.detailContent.querySelector('[data-action="save-cloud-snapshot"]').addEventListener("click", () => saveEntrySnapshotToGoogleSheet(id));
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
    const timer = setTimeout(() => reject(new Error(`${label} 頛?暹?`)), 20000);
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`?⊥?頛 ${label}嚗?蝣箄?蝬脰楝???`));
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
    tesseractLoadPromise = loadScript(OCR_SCRIPT_URL, () => Boolean(window.Tesseract?.recognize), "OCR 璅∠?");
  }
  await tesseractLoadPromise;
  if (!window.Tesseract?.recognize) {
    throw new Error("OCR 璅∠?頛敺?銝?剁?隢??唳???岫");
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
    { lang: "chi_tra+eng", label: "蝜葉/?望?" },
    { lang: "eng", label: "?望?/?詨??" },
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
        mode: `${full.mode} + ?芸?蝺皞,
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
      text: [full.text.trim(), rowText].filter(Boolean).join("\n\n--- 璈怠? OCR ---\n\n"),
      mode: `${full.mode} + 璈怠?鋆?`,
      rows,
      elapsedMs: Math.round(performance.now() - startedAt),
      rowOcrMs: Math.round(performance.now() - rowStartedAt),
      rowCrops: rowResult.crops || [],
      skippedRowCrops: rowResult.skipped || [],
      fallbackRows: fullRows,
      expectedTotalCount,
      rowLineReview,
      completeCircleCount: completeMarkers.count,
      completeCircleMarkers: completeMarkers.markers,
      missingRowCount,
    };
  }

  throw new Error(`OCR ?⊥?摰???{errors.join("嚗?)}`);
}

function extractExpectedHoldingCount(text) {
  const normalized = normalizeOcrText(text);
  const compact = normalized.replace(/\s+/g, "");
  const patterns = [
    /蝮賢(\d{1,3})瑼?,
    /??\d{1,3})瑼?,
    /(\d{1,3})瑼?/,
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
      errors.push(`${attempt.label}: 瘝?颲刻??唳?摮);
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
  const attempts = [{ lang: "chi_tra+eng", label: "璈怠?" }];
  const rows = [];
  const crops = [];
  const skipped = [];

  for (let index = 0; index < rowRects.length; index += 1) {
    const rect = rowRects[index];
    const crop = await cropImageDataUrl(dataUrl, rect);
    const label = rect.fallback ? `?蝚?${index + 1} ? : `蝚?${index + 1} ?;
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

  return { rows, crops, skipped };
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
  const index = normalized.search(/?閱s*??);
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
    image.onerror = () => reject(new Error("??頛憭望?嚗瘜脰? OCR ????));
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
  const columnAttempts = [{ lang: "chi_tra+eng", label: "甈?" }];
  const columns = [
    { key: "name", label: "???∠巨甈?, rect: { x: 0.095, y: 0.215, width: 0.255, height: 0.64 } },
    { key: "shares", label: "蝮質?豢?", rect: { x: 0.535, y: 0.215, width: 0.165, height: 0.64 } },
    { key: "avgCost", label: "?漱?甈?, rect: { x: 0.72, y: 0.215, width: 0.18, height: 0.64 } },
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
    "???蟡冽???,
    column.name || "",
    "?蜇?⊥甈?,
    column.shares || "",
    "??鈭文??寞???,
    column.avgCost || "",
  ].join("\n").trim();
}

async function applyManualRowFix(entryId, rowIndex, values) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry?.parsedRows?.[rowIndex]) return;

  const symbol = normalizeSymbolInput(values.symbol);
  if (!isTwSymbol(symbol)) {
    alert("隢撓?交??誨??靘? 0050??330??0988A");
    return;
  }

  const shares = parseManualNumber(values.shares);
  const avgCost = parseManualNumber(values.avgCost);
  if (shares === null || avgCost === null) {
    alert("隢撓?交???貉??漱?");
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
    reviewReason: officialName ? "" : "?迂敺?",
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

async function parseDraftImages() {
  if (!state.draftImages.length || els.parseDraft.disabled) return;
  els.parseDraft.disabled = true;
  setOcrStatus("頛 OCR 銝?..");
  try {
    const texts = [];
    for (let index = 0; index < state.draftImages.length; index += 1) {
      const image = state.draftImages[index];
      setOcrStatus(`閫??蝚?${index + 1}/${state.draftImages.length} 撘琛);
      const result = await recognizeImage(image, (progress, mode) => {
        setOcrStatus(`閫??蝚?${index + 1}/${state.draftImages.length} 撘?${progress}%嚗?{mode}嚗);
      }, {
        maskEditButtons: els.kind.value === "ark_position",
        columnOcr: els.kind.value === "ark_position",
      });
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
          setOcrStatus(`?閬矽?湔??嚗???${image.completeCircleCount} ???菜葫??${result.rowLineReview.detectedLines} 璇?嚗???${result.rowLineReview.expectedLines} 璇);
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
          reason: `蝮賣??賊＊蝷?${expectedRows} 瑼??桀??蔥閫?? ${parsedRows.length} 蝑??航撠?${missingRows} 蝑,
          extraLineCount: Math.max(0, missingRows - 1),
        }, imageIndex) : "")
        .join("")
      : "";
    els.parsePreview.innerHTML = [
      renderOcrCompleteness(expectedRows, parsedRows.length, missingRows, "draft", expectedTotal ? "total" : "circle"),
      renderParsedRows(parsedRows, "draft", "", columnCrops, rowCrops, skippedRowCrops),
      calibrationBlocks,
    ].join("");
    if (needsCalibration) {
      state.draftImages.forEach((image, imageIndex) => {
        if (image.rowLineReview?.imageDataUrl) bindRowLineReviewControls(imageIndex);
      });
      renderRowLineApplyAction();
    }
    const elapsed = state.draftImages.reduce((sum, image) => sum + (image.ocrElapsedMs || 0), 0);
    const countText = expectedTotal ? `蝮賢 ${expectedTotal} 瑼?` : (expectedRows ? `摰??${expectedRows} ??` : "");
    const missingText = missingRows ? `嚗?賢? ${missingRows} 蝑 : "";
    setOcrStatus(parsedRows.length ? `摰?嚗?{countText}? ${parsedRows.length} 蝑摨怠?${missingText}嚗?{formatDuration(elapsed)}嚗 : `摰?嚗?{countText}?芣??啣澈摮?${missingText}嚗?{formatDuration(elapsed)}嚗);
  } catch (error) {
    console.error(error);
    setOcrStatus("閫??憭望?");
    alert(error.message || "?芸?閫??憭望?嚗???渡?敺?閰?);
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
        <strong>隢?隤踵?芸?蝺?/strong>
        <p>${escapeHtml(review.reason || `蝝??閬?${review.expectedLines} 璇帖???嚗??皜?${review.detectedLines} 璇)}?湔?????嚗?雿輻銝皛▼嚗?蝺?冽??拙?銝剝?嚗???瑕???/p>
      </div>
      <div class="row-line-stage">
        <img src="${review.imageDataUrl}" alt="?芸?蝺皞?閬?>
        ${lines.map((line, index) => `<span class="row-line-overlay${line.extra ? " candidate" : ""}" data-line-overlay="${index}" style="top:${line.value}%"></span>`).join("")}
      </div>
      <div class="row-line-controls">
        ${lines.map((line, index) => `
          <label>
            ${line.extra ? "??蝺? : "蝺?} ${index + 1}
            <input type="range" min="18" max="86" step="0.1" value="${escapeHtml(line.value)}" data-row-line-input="${index}">
          </label>
        `).join("")}
      </div>
    </section>
  `;
}

function renderRowLineApplyAction() {
  if (!els.parsePreview.querySelector("[data-row-line-review]")) return;
  if (els.parsePreview.querySelector("[data-row-line-apply-all]")) return;
  const actions = document.createElement("div");
  actions.className = "row-line-global-actions";
  actions.innerHTML = '<button class="button primary" type="button" data-row-line-apply-all>?冽???瑕?</button>';
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
  container.querySelectorAll("[data-row-line-input]").forEach((input) => {
    input.addEventListener("input", () => {
      const overlay = container.querySelector(`[data-line-overlay="${input.dataset.rowLineInput}"]`);
      if (overlay) overlay.style.top = `${input.value}%`;
    });
  });
  container.querySelectorAll("[data-line-overlay]").forEach((overlay) => {
    overlay.style.cursor = "ns-resize";
    let dragging = false;
    const stage = container.querySelector(".row-line-stage");

    const startDrag = (e) => {
      dragging = true;
      e.preventDefault();
    };
    const moveDrag = (e) => {
      if (!dragging || !stage) return;
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      let pct = ((clientY - rect.top) / rect.height) * 100;
      pct = Math.min(86, Math.max(18, pct));
      overlay.style.top = `${pct}%`;
      const idx = overlay.dataset.lineOverlay;
      const input = container.querySelector(`[data-row-line-input="${idx}"]`);
      if (input) { input.value = pct.toFixed(1); }
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
      const linePercents = [...container.querySelectorAll("[data-row-line-input]")]
        .map((input) => Number(input.value))
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
    button.textContent = "?瑕?銝?..";
  }
  setOcrStatus("雿輻隤踵敺??閫??????葉...");
  try {
    const resultTextParts = [];
    for (let order = 0; order < calibrations.length; order += 1) {
      const { imageIndex, linePercents } = calibrations[order];
      const image = state.draftImages[imageIndex];
      if (!image) continue;
      const result = await recognizeImage(image, (progress, mode) => {
        setOcrStatus(`?芸?蝺圾??${order + 1}/${calibrations.length}嚗?{progress}%嚗?{mode}嚗);
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
    const elapsed = state.draftImages.reduce((sum, image) => sum + (image.ocrElapsedMs || 0), 0);
    setOcrStatus(`?芸?閫??摰?嚗???${expectedRows || "?"} 蝑??桀?閫?? ${parsedRows.length} 蝑?{missingRows ? `嚗?賢? ${missingRows} 蝑 : ""}嚗?{formatDuration(elapsed)}嚗);
  } catch (error) {
    console.error(error);
    setOcrStatus("?芸?蝺圾?仃??);
    alert(error.message || "?芸?蝺圾?仃??隢??啗矽?游??岫??);
    if (button) {
      button.disabled = false;
      button.textContent = "?冽???瑕?";
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
    button.textContent = "?瑕?銝?..";
  }
  setOcrStatus("雿輻隤踵敺??閫??銝?..");
  try {
    const result = await recognizeImage(image, (progress, mode) => {
      setOcrStatus(`雿輻隤踵蝺圾??${progress}%嚗?{mode}嚗);
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
    setOcrStatus(`摰?嚗?{image.expectedTotalCount ? `蝮賢 ${image.expectedTotalCount} 瑼 : `摰??${image.completeCircleCount || 0} ?}嚗???${parsedRows.length} 蝑摨怠?嚗?{formatDuration(result.elapsedMs || 0)}嚗);
  } catch (error) {
    console.error(error);
    setOcrStatus("閫??憭望?");
    alert(error.message || "?芸?閫??憭望?嚗???渡?敺?閰?);
    if (button) {
      button.disabled = false;
      button.textContent = "?冽???瑕?";
    }
  }
}

async function parseExistingEntry(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry?.images?.length) return;
  const button = els.detailContent.querySelector('[data-action="parse-entry"]');
  button.disabled = true;
  button.textContent = "閫??銝?..";
  try {
    const result = await recognizeImage(entry.images[0], (progress, mode) => {
      button.textContent = `閫??銝?${progress}%嚗?{mode}嚗;
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
    alert(error.message || "?芸?閫??憭望?嚗???渡?敺?閰?);
    button.disabled = false;
    button.textContent = "?閫???芸?";
  }
}

function normalizeOcrText(text) {
  return String(text || "")
    .replace(/[嚗?嚗/g, (value) => String.fromCharCode(value.charCodeAt(0) - 0xfee0))
    .replace(/[嚗/g, ",")
    .replace(/[嚗/g, "%")
    .replace(/[嚗/g, "+")
    .replace(/[嚗/g, "-")
    .replace(/[|嚚/g, " ")
    .replace(/[嚗/g, ":");
}

function parseNumberToken(token) {
  const normalized = String(token || "")
    .replace(/[,$]/g, "")
    .replace(/[()]/g, "")
    .replace(/[嚗?]/g, "")
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
  if (!/?閱s*??.test(normalized) || !compact.includes("?曇")) return null;

  const holdingIndex = normalized.search(/?閱s*??);
  const numbers = extractNumbersAfterHolding(normalized);
  if (numbers.length < 2) return null;

  const shares = numbers.find((value) => Number.isInteger(value) && value > 0) ?? null;
  const rawAvgCost = numbers.find((value) => value !== shares && value > 0) ?? null;
  const avgCost = normalizeArkAvgCost(rawAvgCost);
  if (shares === null || avgCost === null) return null;

  const beforeHolding = holdingIndex >= 0 ? normalized.slice(0, holdingIndex) : normalized;
  const ocrName = cleanArkNamePart(beforeHolding);
  const symbol = findKnownSymbolInText(normalized) || findSymbolByOcrName(ocrName || normalized);
  const officialName = lookupSymbolName(symbol);

  return {
    symbol,
    name: officialName || ocrName,
    ocrName,
    kind: "?曇",
    shares,
    avgCost,
    currentPrice: null,
    pnl: null,
    pnlRate: null,
    source: "ark_row_ocr",
    rawLine: normalized.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(" / "),
    needsReview: !officialName,
    reviewReason: symbol ? "?迂敺?" : "隞??敺?",
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
    瘞? "2330",
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
    .replace(/[?箏]/g, "??)
    .replace(/[?岷]/g, "??)
    .replace(/[撖/g, "撖?)
    .replace(/[銝]/g, "5")
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
    `??{crop.label}?,
    crop.text || "",
  ].join("\n"));
  const skipped = (result.skipped || []).map((crop) => [
    `???${crop.label}?,
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
      kind: "?曇",
      shares: shares[index] ?? null,
      avgCost: avgCosts[index] ?? null,
      currentPrice: null,
      pnl: null,
      pnlRate: null,
      source: "ark_column_ocr",
      rawLine: [
        nameRow.rawLine,
        shares[index] !== undefined ? `?⊥:${shares[index]}` : "",
        avgCosts[index] !== undefined ? `?:${avgCosts[index]}` : "",
      ].filter(Boolean).join(" | "),
      needsReview: !symbol || !officialName,
      reviewReason: symbol ? "?迂敺?" : "隞??敺?",
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

function parseArkPositionRows(lines) {
  const rows = [];
  const pendingNameLines = [];
  const consumed = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    if (consumed.has(index)) continue;

    const line = lines[index];
    if (isNoiseLine(line)) continue;

    const holdingMatch = line.match(/?閱s*?﹏s+([\d,]+)\s+([\d,.]+)/);
    if (!holdingMatch) {
      pendingNameLines.push(line);
      continue;
    }

    const beforeHolding = line.slice(0, holdingMatch.index).trim();
    const symbolInfo = findNearbySymbol(lines, index, pendingNameLines);
    if (symbolInfo?.index > index) consumed.add(symbolInfo.index);

    const symbol = symbolInfo?.symbol || "";
    const ocrName = buildArkName(pendingNameLines, beforeHolding, symbol);
    const officialName = lookupSymbolName(symbol);
    const shares = parseNumberToken(holdingMatch[1]);
    const avgCost = parseNumberToken(holdingMatch[2]);

    rows.push({
      symbol,
      name: officialName || ocrName,
      ocrName,
      kind: "?曇",
      shares,
      avgCost,
      currentPrice: null,
      pnl: null,
      pnlRate: null,
      source: "ark_position",
      rawLine: [pendingNameLines.join(" / "), line, symbolInfo?.line].filter(Boolean).join(" | "),
      needsReview: !officialName,
      reviewReason: symbol ? "?迂敺?" : "隞??敺?",
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
        percent: /[%嚗/.test(token),
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
  return /^(?蝺刻摩摨怠?|蝺刻摩 摨怠?|?啗摨怠?|????摨怠?|蝢摨怠?|蝢???摨怠?|???∠巨|?????∠巨|蝮賢|蝮??悴?啣??|??憓?????/.test(compactText(line));
}

function lookupSymbolName(symbol) {
  return SYMBOL_NAMES[String(symbol || "").toUpperCase()] || "";
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, "");
}

function isTwSymbol(value) {
  return /^\d{4,6}[A-Z]?$/.test(String(value || "").trim());
}

function findNearbySymbol(lines, index, pendingNameLines) {
  for (let offset = 1; offset <= 4; offset += 1) {
    const candidateLine = lines[index + offset];
    if (offset > 1 && /?閱s*?﹏s+[\d,]+\s+[\d,.]+/.test(candidateLine || "")) break;
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
  return isTwSymbol(compact) ? compact : "";
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
    .replace(/?閱s*??*/, "")
    .replace(/\b\d{4,6}[A-Z]?\b/g, "")
    .replace(/[\d,]+(?:\.\d+)?/g, "")
    .replace(/[?[\]??'`~!@#$%^&*_=+|\\/:;嚗?.?嚗??批???]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = text.split(" ").filter(Boolean);
  if (tokens.length > 1 && /^(隡?育???撣咽?徑?砝蝚?$/.test(tokens[0])) {
    tokens.shift();
  }

  text = tokens.join("");
  if (/^(???∠巨|蝔桅?|蝮質?腮?漱?|?啗摨怠?|蝢摨怠?)$/.test(text)) return "";
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
    if (seen.has(row.symbol)) {
      result[seen.get(row.symbol)] = row;
      continue;
    }
    seen.set(row.symbol, result.length);
    result.push(row);
  }
  return result;
}

function displayValue(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return `${value}${suffix}`;
}

function formatDuration(ms) {
  if (!ms) return "0 蝘?;
  return `${(ms / 1000).toFixed(1)} 蝘;
}

function renderOcrTiming(entry) {
  if (!entry.ocrElapsedMs) return "";
  const cropMs = entry.rowOcrMs || entry.columnOcrMs;
  const cropLabel = entry.rowOcrMs ? "璈怠?" : "甈?";
  const columnText = cropMs ? `嚗?{cropLabel} ${formatDuration(cropMs)}` : "";
  return `<div class="detail-field"><span>OCR ??</span><strong>${formatDuration(entry.ocrElapsedMs)}${columnText}</strong></div>`;
}

function renderOcrCompleteness(expectedRows, parsedRows, missingRows, context, source = "circle") {
  if (!expectedRows) return "";
  const complete = missingRows <= 0;
  const className = `${context === "detail" ? "detail-field" : "parsed-card"} ocr-completeness ${complete ? "complete" : "warning"}`;
  const label = source === "total" ? "蝮賣??豢炎?? : "摰?瑼Ｘ";
  const body = source === "total"
    ? `?恍憿舐內蝮賢 ${expectedRows} 瑼??桀?閫?? ${parsedRows} 蝑
    : `?芸??摰?? ${expectedRows} ???桀?閫?? ${parsedRows} 蝑;
  return `
    <div class="${className}">
      <span>${label}</span>
      <strong>${complete ? "閫??蝑蝚血?" : `?航撠?${missingRows} 蝑}</strong>
      <p>${body}</p>
    </div>
  `;
}

function renderParsedRows(rows, context, entryId = "", columnCrops = [], rowCrops = [], skippedRowCrops = []) {
  const rowDiagnostics = renderRowCropDiagnostics(rowCrops, skippedRowCrops);
  if (!rows?.length) {
    const crops = rowDiagnostics || renderColumnCrops(columnCrops);
    if (crops) {
      return `
        <div class="${context === "detail" ? "detail-field" : "parsed-card"}">
          <span>閫??摨怠?</span>
          <div class="pre-wrap">撠?摨怠???/div>
          ${crops}
        </div>
      `;
    }
    return context === "detail"
      ? `<div class="detail-field"><span>閫??摨怠?</span><div class="pre-wrap">撠?摨怠???/div></div>`
      : "";
  }
  const body = rows.map((row, index) => `
    <tr>
      <td>${renderRowCropCell(row)}</td>
      <td>${escapeHtml(row.symbol || "敺Ⅱ隤?)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.kind || "")}</td>
      <td>${escapeHtml(displayValue(row.shares))}</td>
      <td>${escapeHtml(displayValue(row.avgCost))}</td>
      <td>${escapeHtml(row.needsReview ? row.reviewReason || "敺Ⅱ隤? : "")}</td>
      <td>${renderRowFixCell(row, index, context, entryId)}</td>
      <td class="raw-cell">${escapeHtml(row.rawLine || "")}</td>
    </tr>
  `).join("");
  return `
    <div class="${context === "detail" ? "detail-field" : "parsed-card"}">
      <span>閫??摨怠?</span>
      <div class="table-scroll">
        <table class="parsed-table">
          <thead>
            <tr>
              <th>?芸?</th>
              <th>隞??</th>
              <th>?迂</th>
              <th>蝔桅?</th>
              <th>?⊥</th>
              <th>?漱?</th>
              <th>???/th>
              <th>靽格迤</th>
              <th>OCR ?憛?/th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      ${rowDiagnostics}
      ${renderColumnCrops(columnCrops)}
    </div>
  `;
}

function renderRowCropCell(row) {
  if (!row?.crop?.dataUrl) return "";
  return `
    <figure class="row-crop">
      <img src="${row.crop.dataUrl}" alt="${escapeHtml(row.crop.label || "?璈怠?鋆?")}">
      <figcaption>${escapeHtml(row.crop.label || "")}</figcaption>
    </figure>
  `;
}

function renderRowCropDiagnostics(rowCrops, skippedRowCrops = []) {
  const unique = [];
  const seen = new Set();
  for (const crop of [...(rowCrops || []), ...(skippedRowCrops || [])]) {
    const key = crop?.key || crop?.dataUrl;
    if (!crop?.dataUrl || seen.has(key)) continue;
    seen.add(key);
    unique.push(crop);
  }
  if (!unique.length) return "";

  const items = unique.map((crop) => {
    const imported = crop.status === "imported";
    const statusText = crop.fallback ? "??" : (imported ? "撌脤脣澈摮? : "?芸??);
    const text = String(crop.text || "").trim();
    return `
      <figure class="diagnostic-crop ${imported ? "imported" : "skipped"} ${crop.fallback ? "fallback" : ""}">
        <img src="${crop.dataUrl}" alt="${escapeHtml(crop.label || "?璈怠?鋆?")}">
        <figcaption>
          <strong>${escapeHtml(crop.label || "璈怠?")}</strong>
          <span>${statusText}</span>
          <small>${escapeHtml(text || "OCR 瘝儘霅??")}</small>
        </figcaption>
      </figure>
    `;
  }).join("");

  return `
    <div class="row-diagnostics" aria-label="?璈怠?鋆?閮箸">
      ${items}
    </div>
  `;
}

function renderColumnCrops(crops) {
  if (!Array.isArray(crops) || !crops.length) return "";
  const items = crops.map((crop) => `
    <figure class="column-crop">
      <img src="${crop.dataUrl || ""}" alt="${escapeHtml(crop.label || "甈?鋆?")}">
      <figcaption>${escapeHtml(crop.label || "甈?鋆?")}</figcaption>
    </figure>
  `).join("");
  return `
    <div class="column-crops" aria-label="?箏?甈?鋆?撠">
      ${items}
    </div>
  `;
}

function renderRowFixCell(row, index, context, entryId) {
  if (context !== "detail" || !entryId) return "";
  return `
    <div class="row-fix">
      <label>隞??<input data-symbol-input="${index}" type="text" inputmode="text" value="${escapeHtml(row.symbol || "")}"></label>
      <label>?⊥<input data-shares-input="${index}" type="number" step="0.001" inputmode="decimal" value="${escapeHtml(row.shares ?? "")}"></label>
      <label>?<input data-avg-cost-input="${index}" type="number" step="0.001" inputmode="decimal" value="${escapeHtml(row.avgCost ?? "")}"></label>
      <button class="button secondary compact" type="button" data-action="apply-row-fix" data-row-index="${index}">憟</button>
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

function resetGoogleSession(message = "隢蝙?冽?甈? Google 撣唾??餃??) {
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
  const clientId = prompt("Google OAuth Client ID嚗eb application嚗?, normalizeClientId(current.clientId));
  if (clientId === null) return null;
  const config = {
    spreadsheetId: spreadsheetId.trim() || DEFAULT_SPREADSHEET_ID,
    clientId: normalizeClientId(clientId),
    authorizedEmail: DEFAULT_AUTHORIZED_EMAIL,
  };
  saveSheetSyncConfig(config);
  resetGoogleSession(config.clientId
    ? "閮剖?撌脣摮?隢蝙?冽?甈董??乓?
    : "隢?朣?OAuth Client ID??);
  return config;
}

function setAppLocked(locked) {
  els.appShell?.classList.toggle("is-locked", locked);
  if (els.authGate) els.authGate.hidden = !locked;
}

function renderAuthGate(message = "") {
  if (!els.authGate) return;
  const config = getSheetSyncConfig();
  const status = message || state.auth.message || "隢蝙?冽?甈? Google 撣唾??餃??;
  els.authStatus.textContent = status;
  els.authEmail.textContent = config.authorizedEmail
    ? `?迂撣唾?嚗?{config.authorizedEmail}`
    : "?迂撣唾??芾身摰?;
  els.authSignIn.disabled = !config.clientId || !config.authorizedEmail;
  els.authSignIn.textContent = state.auth.authorized ? "撌脩?? : "雿輻 Google ?餃";
}

function ensureAuthConfig() {
  const config = getSheetSyncConfig();
  if (config.clientId) return config;
  const updated = configureSheetSync();
  if (!updated?.clientId) {
    throw new Error("隢?閮剖? OAuth Client ID");
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
  if (!email) throw new Error("Google 撣唾?瘝?? email嚗???餃??);
  if (!allowed) throw new Error("?迂?餃??Google Email 撠閮剖?");
  if (email !== allowed) {
    state.auth = {
      signedIn: true,
      authorized: false,
      email,
      message: `甇?Google 撣唾??芣?甈?${email}`,
    };
    setAppLocked(true);
    renderAuthGate();
    throw new Error(`甇?Google 撣唾??芣?甈?${email}`);
  }
  state.auth = {
    signedIn: true,
    authorized: true,
    email,
    message: `撌脩?伐?${email}`,
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
      "Google ?餃璅∠?",
    );
  }
  await googleIdentityLoadPromise;
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google ?餃璅∠?頛敺?銝?剁?隢??唳???岫");
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
  if (!config.spreadsheetId) throw new Error("撠閮剖? Google Sheet ID");
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
    throw new Error(payload.errors?.[0]?.detailed_message || payload.errors?.[0]?.reason || "Google Sheet 霈?仃??);
  }
  return (payload.table?.rows || []).map((row) => (row.c || []).map((cell) => cell?.v ?? ""));
}

async function readPublicSheetValues(sheetName) {
  return new Promise((resolve, reject) => {
    const callbackName = `assetflowInvestSheet_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("霈??Google Sheet ?暹?嚗?蝣箄? 2026 Invest ?臬?迂?仿?????犖瑼Ｚ?"));
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
      reject(new Error("霈??Google Sheet 憭望?嚗?蝣箄? 2026 Invest ?臬?迂?仿?????犖瑼Ｚ?"));
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
  return sheetsFetch(`/values/${sheetRange(sheetName, range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
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
}

async function ensureCloudSheetTables() {
  if (sheetTablesReady) return;
  await ensureSheetTables();
  sheetTablesReady = true;
}

function validSnapshotRows(rows) {
  return (rows || []).filter((row) => row?.symbol && row?.shares !== null && row?.shares !== undefined && row?.avgCost !== null && row?.avgCost !== undefined);
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
  return `${row.symbol}${row.name ? ` ${row.name}` : ""}嚗?{formatNumber(row.shares, 3)} ??/ ${formatNumber(row.avgCost, 3)}`;
}

function formatSnapshotDiff(diff, limit = 18) {
  const lines = [];
  for (const row of diff.added) lines.push(`?啣? ${snapshotDiffLine(row)}`);
  for (const row of diff.removed) lines.push(`蝘駁 ${snapshotDiffLine(row)}`);
  for (const row of diff.changed) {
    lines.push(`霈 ${row.symbol}${row.name ? ` ${row.name}` : ""}嚗??${formatNumber(row.previousShares, 3)} ??${formatNumber(row.currentShares, 3)}嚗???${formatNumber(row.previousCost, 3)} ??${formatNumber(row.currentCost, 3)}`);
  }
  if (lines.length > limit) {
    return [...lines.slice(0, limit), `...?行? ${lines.length - limit} 蝑榆?躬].join("\n");
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
      `?脩垢撌脣???${date} ${marketLabel(market)} 敹怎 ${existingSnapshots.length} 蝑,
      "撌桃嚗?,
      diffText,
      "",
      "?臬?券活??啣翰?批?隞???亙?撣??敹怎嚗?,
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
  if (!date) return "隢??豢??交???;
  if (!targets.length) return "???撣瘝??脩垢敹怎??;
  const positionCount = targets.reduce((sum, snapshot) => (
    sum + snapshotPositionsFromList(snapshot.snapshotId, state.cloudHistory.positions).length
  ), 0);
  const marketSummary = [...new Set(targets.map((snapshot) => marketLabel(snapshot.market)))].join(" / ");
  return `撠??${targets.length} 蝑?${marketSummary} 敹怎??${positionCount} 蝑澈摮?蝝啜;
}

function renderSnapshotDeleteOptions(selectedDate = "") {
  const dates = cloudSnapshotDates();
  if (!dates.length) {
    return "<p class=\"muted-text\">?桀?瘝??臬?斤??脩垢敹怎??/p>";
  }
  const currentDate = normalizeDateText(selectedDate) || normalizeDateText(state.cloudSnapshot?.snapshot?.date) || dates[0];
  const currentMarket = normalizeMarketKey(state.cloudSnapshot?.snapshot?.market) || "TW";
  const dateOptions = dates.map((date) => (
    `<option value="${escapeHtml(date)}"${date === currentDate ? " selected" : ""}>${escapeHtml(date)}</option>`
  )).join("");
  return `
    <div class="snapshot-delete-form">
      <label>
        ?交?
        <select id="delete-snapshot-date">${dateOptions}</select>
      </label>
      <label>
        撣
        <select id="delete-snapshot-market">
          <option value="TW"${currentMarket === "TW" ? " selected" : ""}>?啗</option>
          <option value="US"${currentMarket === "US" ? " selected" : ""}>蝢</option>
          <option value="ALL">閰脫??典???/option>
        </select>
      </label>
      <button id="delete-cloud-snapshot" class="button ghost danger compact" type="button">?芷敹怎</button>
    </div>
    <p id="delete-snapshot-preview" class="snapshot-delete-preview">${escapeHtml(snapshotDeletePreviewText(currentDate, currentMarket))}</p>
  `;
}

function renderCloudSnapshotSwipeList() {
  const rows = [...(state.cloudHistory.snapshots || [])]
    .sort((a, b) => snapshotSortValue(b).localeCompare(snapshotSortValue(a)))
    .map(snapshotMetrics);
  if (!rows.length) return "<p class=\"muted-text\">?桀?瘝??脩垢敹怎??/p>";
  return `
    <div class="snapshot-swipe-list">
      ${rows.map((snapshot) => `
        <div class="swipe-row" data-snapshot-id="${escapeHtml(snapshot.snapshotId)}">
          <button class="swipe-delete-action" type="button" data-delete-snapshot-id="${escapeHtml(snapshot.snapshotId)}">?芷</button>
          <div class="swipe-row-content">
            <div>
              <strong>${escapeHtml(snapshot.date || "")}</strong>
              <span>${marketLabel(snapshot.market)} 繚 ${formatNumber(snapshot.stockCount)} 瑼?繚 ${formatMoney(snapshot.totalCost)}</span>
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
    .filter((entry) => entry.kind === "ark_position" && ["reviewed", "imported"].includes(entry.status))
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
      if (!symbol || /敺?/.test(symbol)) continue;
      const existing = bySymbol.get(symbol);
      const normalized = { ...row, source: `${item.entry.title || item.entry.id}` };
      if (!existing) {
        bySymbol.set(symbol, normalized);
        continue;
      }
      const sameShares = Number(existing.shares) === Number(row.shares);
      const sameAvgCost = Number(existing.avgCost) === Number(row.avgCost);
      if (!sameShares || !sameAvgCost) {
        conflicts.push(`${symbol}嚗?{existing.shares}/${existing.avgCost} vs ${row.shares}/${row.avgCost}`);
      }
    }
  }

  const rows = [...bySymbol.values()].sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)));
  return { candidates, rows, conflicts };
}

async function saveMergedSnapshotToGoogleSheet() {
  const { candidates, rows, conflicts } = mergeSnapshotEntries(state.entries);
  if (!candidates.length) {
    alert("?桀?瘝?撌脩Ⅱ隤?撌脣?亦??寡?摨怠??芸??臬?雿萸?);
    return;
  }
  if (!rows.length) {
    alert("撌脩Ⅱ隤?葉瘝??臬?雿萇?摨怠????Ⅱ隤?OCR 閫??蝯??蟡其誨??);
    return;
  }
  if (conflicts.length) {
    alert(`?蔥敹怎?潛?誨??蝒?隢????蝝堆??刻圾?澈摮”?耨甇??隤踵?⊥??鈭文??孵???嚗n\n${conflicts.slice(0, 8).join("\n")}`);
    return;
  }

  const markets = [...new Set(candidates.map((item) => item.entry.market).filter(Boolean))];
  const marketGroups = splitRowsByMarket(rows, markets.length === 1 ? markets[0] : "");
  const confirmed = confirm(`撠?${candidates.length} 撘菜?澈摮??雿菜? ${marketGroups.length} ???游翰?改???${rows.length} 蝑澈摮????游歇?翰?改????撌桃?岷??血?隞?Ⅱ摰匱蝥?`);
  if (!confirmed) return;

  const button = els.saveMergedSnapshot;
  if (button) {
    button.disabled = true;
    button.textContent = "?蔥撖怠銝?..";
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
      sourceTitle: `?蔥敹怎嚗?{candidates.length} 撘菜?,
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
      alert("?脩垢撌脣??典??乓?撣???批捆?翰?改??芷?銴神?乓?);
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
    alert(`撌脣?雿萄???Google Sheet嚗?{rows.length} 蝑澈摮?${result.written.length} ???游翰??{result.replacedCount ? `嚗?隞?${result.replacedCount} 蝑?敹怎` : ""}`);
  } catch (error) {
    console.error(error);
    alert(error.message || "?蔥撖怠 Google Sheet 憭望?");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "?蔥摮蝡?;
    }
  }
}
async function saveEntrySnapshotToGoogleSheet(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  const payloads = buildMarketSnapshotPayloads(entry);
  const rowCount = payloads.reduce((sum, payload) => sum + payload.positionRows.length, 0);
  if (!rowCount) {
    alert("?桀?瘝??臬???Google Sheet ?澈摮???);
    return;
  }

  const button = els.detailContent.querySelector('[data-action="save-cloud-snapshot"]');
  if (button) {
    button.disabled = true;
    button.textContent = "撖怠銝?..";
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
      alert("?脩垢撌脣??典??乓?撣???批捆?翰?改??芷?銴神?乓?);
      return;
    }
    entry.status = "imported";
    entry.sheetSnapshotId = sheetSnapshotIds.join(",");
    entry.updatedAt = new Date().toISOString();
    await txStore("readwrite", (store) => store.put(entry));
    await loadLatestCloudSnapshot(false);
    render();
    openDetail(id);
    alert(`撌脣???Google Sheet嚗?{rowCount} 蝑澈摮?${result.written.length} ???游翰??{result.replacedCount ? `嚗?隞?${result.replacedCount} 蝑?敹怎` : ""}`);
  } catch (error) {
    console.error(error);
    alert(error.message || "撖怠 Google Sheet 憭望?");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "摮 Google Sheet";
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
    market: row[2] || "",
    symbol: row[3] || "",
    name: row[4] || "",
    kind: row[5] || "",
    shares: Number(row[6] || 0),
    avgCost: Number(row[7] || 0),
    source: row[8] || "",
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
    await loadTargetLevelHistory();
    const layoutValues = await readCloudSheetValues(SHEET_NAMES.layout, "A2:G").catch(() => []);
    const layout = parseLayoutRows(stripHeaderRow(layoutValues, SHEET_HEADERS.layout));
    state.cloudHistory = { snapshots, positions, layout };
    if (!snapshots.length) {
      state.cloudSnapshot = null;
      state.cloudLoading = false;
      renderCloudSnapshot();
      if (showAlert) alert("Google Sheet ?桀????澈摮翰?扼?);
      return;
    }
    const latest = snapshots[0];
    const latestPositions = positions.filter((row) => row.snapshotId === latest.snapshotId);
    state.cloudSnapshot = { snapshot: latest, positions: latestPositions };
    state.cloudLoading = false;
    renderCloudSnapshot();
    renderSummaryLine();
    if (showAlert) alert(`撌脰??蝡臬澈摮?${latestPositions.length} 蝑);
    const symbols = [...new Set(latestPositions.map((p) => p.symbol).filter(Boolean))];
    fetchQuotes(symbols);
  } catch (error) {
    console.error(error);
    state.cloudLoading = false;
    renderCloudSnapshot();
    if (showAlert) alert(error.message || "霈??Google Sheet 憭望?");
  }
}

function stripHeaderRow(values, headers) {
  if (!values?.length) return [];
  const first = values[0].map((value) => String(value || "").trim());
  const sameHeader = headers.every((header, index) => first[index] === header);
  return sameHeader ? values.slice(1) : values;
}

async function fetchQuotes(symbols) {
  if (!symbols?.length) return;
  try {
    const url = `${QUOTE_PROXY_URL}?symbols=${encodeURIComponent(symbols.join(","))}`;
    const resp = await fetch(url);
    if (!resp.ok) return;
    const data = await resp.json();
    if (data?.quotes) {
      Object.assign(state.quotes, data.quotes);
      renderCloudSnapshot();
    }
  } catch (err) {
    console.warn("fetchQuotes", err);
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
  if (!points.length) return "<p class=\"muted-text\">撠頞喳?敹怎撱箇?撣?????/p>";
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
            <span>${item.isInitial ? "??摨怠?" : `${item.deltas.length} 瑼??}</span>
          </div>
          <span>${item.targetLevel === null ? "瘞港??芾身摰? : formatPercent(item.targetLevel)}</span>
          <div class="layout-cost-meter ${barClass}">
            <span style="width: ${widthPercent(Math.abs(item.netLayoutCost), maxAbsCost)}%"></span>
          </div>
          <b>${item.isInitial ? "?箸?" : formatSignedMoney(item.netLayoutCost)}</b>
        </div>
      `;
    }).join("");
    return `<h4 class="market-section-heading">${marketLabel(market)}</h4>${rows}`;
  }).join("");
}

function renderDailyShareMatrix(points) {
  if (!points.length) return "<p class=\"muted-text\">撠??⊥??摨???/p>";
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
          <thead><tr><th>?</th>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }).join("");
}

function renderTargetLevelChart(history) {
  const rangeKey = state.levelChartRange || "1M";
  const rangeDays = { "1M": 31, "6M": 183, "1Y": 365 };
  const days = rangeDays[rangeKey] || 31;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const filtered = history.filter((item) => item.date >= cutoff);
  const allDates = [...new Set(filtered.map((item) => item.date))].sort();
  if (!allDates.length) return "<p class=\"muted-text\">撠甇瑕瘞港?鞈???/p>";
  const markets = ["TW", "US"];
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
  return `
    <div class="level-chart-wrap">
      <div class="level-chart-topbar">
        <div class="level-chart-legend">${legend}</div>
        <div class="level-range-btns">${rangeBtns}</div>
      </div>
      <div class="level-chart-container" style="position:relative">
        <svg viewBox="0 0 ${W} ${H}" class="level-chart-svg" aria-label="撱箄降瘞港?頞典">
          ${yLines.join("")}
          ${xLabels}
          ${lines}
        </svg>
      </div>
    </div>
  `;
}

function renderLayoutDeltaTable(points) {
  if (!points.length) return "<p class=\"muted-text\">?桀????翰?批榆?啣閮???/p>";
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
              <th>?交?</th>
              <th>隞??</th>
              <th>?迂</th>
              <th>撣??⊥</th>
              <th>隡啁??</th>
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
  if (!dates.length) return "<p class=\"muted-text\">?閬撠蝑翰?扳??賡＊蝷箄隅?Ｕ?/p>";
  const PL = 52; const PR = 8; const PT = 8; const PB = 24;
  const cW = W - PL - PR; const cH = H - PT - PB;
  const allVals = series.flatMap((s) => s.pts.map((p) => p.v));
  if (!allVals.length) return "<p class=\"muted-text\">撠鞈???/p>";
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
    return `<text x="${xPos(i)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="var(--muted)">${d.slice(5)}</text>`;
  }).join("");
  const yStep = maxV > 5000 ? 1000 : maxV > 1000 ? 500 : maxV > 200 ? 100 : maxV > 50 ? 20 : 10;
  const yLines = [];
  if (minV < 0) {
    const y0 = yPos(0);
    yLines.push(`<line x1="${PL}" y1="${y0}" x2="${W - PR}" y2="${y0}" stroke="var(--line)" stroke-width="1"/>`);
    yLines.push(`<text x="${PL - 4}" y="${y0 + 4}" text-anchor="end" font-size="9" fill="var(--muted)">0</text>`);
  }
  for (let v = yStep; v <= maxV; v += yStep) {
    const y = yPos(v);
    yLines.push(`<line x1="${PL}" y1="${y}" x2="${W - PR}" y2="${y}" stroke="var(--line)" stroke-width="0.5"/>`);
    yLines.push(`<text x="${PL - 4}" y="${y + 4}" text-anchor="end" font-size="9" fill="var(--muted)">${v >= 1000 ? `${v / 1000}k` : v}</text>`);
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
    const dots = pts.map((p) => `<circle cx="${xPos(p.i)}" cy="${yPos(p.v)}" r="2.5" fill="${color}"><title>${dates[p.i]} ${p.v.toLocaleString()}</title></circle>`).join("");
    return polylines + dots;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="level-chart-svg">${yLines.join("")}${xLabels}${svgLines}</svg>`;
}

function renderLayoutSharesChart(cloudHistory) {
  const { snapshots, allPositions, dates } = buildSharesTimeline(cloudHistory);
  if (dates.length < 2) return "<p class=\"muted-text\">?閬撠蝑翰?扳??賡＊蝷箄隅?Ｕ?/p>";
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
  const layout = cloudHistory?.layout || [];
  const layoutRows = layout.filter((r) => r.symbol === symbol);
  if (layoutRows.length > 0) {
    // 優先用 delta
    const dates = [...new Set(layoutRows.map((r) => r.date))].sort();
    const pts = dates.map((d, i) => {
      const row = layoutRows.find((r) => r.date === d);
      return row ? { i, v: row.delta } : null;
    }).filter(Boolean);
    if (pts.length) return renderSharesSvg([{ pts, color: "var(--green)" }], dates, {});
  }
  // fallback: 讀 positions（累積持股）
  const snapshots = (cloudHistory?.snapshots || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const positions = cloudHistory?.positions || [];
  const dates = [...new Set(snapshots.map((s) => s.date || s.createdAt?.slice(0, 10) || ""))].sort();
  const pts = dates.map((d, i) => {
    const snap = snapshots.find((s) => (s.date || s.createdAt?.slice(0, 10)) === d);
    if (!snap) return null;
    const pos = positions.find((r) => r.snapshotId === snap.snapshotId && r.symbol === symbol);
    return pos ? { i, v: Number(pos.shares || 0) } : null;
  }).filter(Boolean);
  if (!pts.length) return "";
  return renderSharesSvg([{ pts, color: "#4f8ef7" }], dates, {});
}

function renderAllSymbolsChart(cloudHistory) {
  const layout = cloudHistory?.layout || [];
  if (!layout.length) return "<p class=\"muted-text\">?閬撠蝑翰?扳??賡＊蝷箄隅?Ｕ?/p>";
  const dates = [...new Set(layout.map((r) => r.date))].sort();
  if (dates.length < 2) return "<p class=\"muted-text\">?閬撠蝑翰?扳??賡＊蝷箄隅?Ｕ?/p>";
  const palette = ["#2f7d5b", "#4f8ef7", "#e07b39", "#9b59b6", "#e74c3c", "#1abc9c", "#f39c12", "#2980b9"];
  const symbols = [...new Set(layout.map((r) => r.symbol))].sort();
  const series = symbols.map((symbol, si) => {
    const pts = dates.map((d, i) => {
      const row = layout.find((r) => r.symbol === symbol && r.date === d);
      return row ? { i, v: row.delta } : null;
    }).filter(Boolean);
    return { symbol, pts, color: palette[si % palette.length] };
  }).filter((s) => s.pts.length > 0);
  if (!series.length) return "<p class=\"muted-text\">撠撣?撌桃鞈???/p>";
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

function renderCloudSnapshot() {
  if (!els.cloudSnapshot) return;
  const cloud = state.cloudSnapshot;
  if (!cloud?.snapshot) {
    const title = state.cloudLoading ? "甇?頛?脩垢摨怠?" : "?餃敺??芸?頛?桀?摨怠?";
    const body = state.cloudLoading
      ? "甇?霈??Google Sheet ???啣翰?扯?甇瑕鞈???
      : "?桀????蝡臬翰?扼??Ⅱ隤??澈摮??雿萄??脩垢???ㄐ撠望?霈?瘥予?澈摮偌雿?頞典????;
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
  const positions = cloud.positions || [];
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
  const marketCards = marketSummaries.map((item) => `
    <section class="market-water-card">
      <div class="card-heading">
        <h3>${marketLabel(item.market)}</h3>
        <span>${item.stockCount} 瑼澈摮?/span>
      </div>
      <div class="market-water-main">
        <div>
          <span>?寡?撱箄降蝮賣偌雿?/span>
          <strong>${item.targetLevel === null ? "?芾身摰? : formatPercent(item.targetLevel)}</strong>
        </div>
        <label>
          隤踵撱箄降瘞港?
          <input class="target-level-input" data-target-level-market="${item.market}" type="number" min="0" max="100" step="0.1" inputmode="decimal" value="${escapeHtml(item.targetLevel ?? "")}">
        </label>
      </div>
      <div class="market-stats">
        <span>隡啁??? <b>${formatMoney(item.totalCost)}</b></span>
        <span>蝮質??<b>${formatNumber(item.totalShares, 3)}</b></span>
      </div>
      <div class="meter" aria-label="${marketLabel(item.market)} 隡啁???">
        <span style="width: ${widthPercent(item.totalCost, maxMarketCost)}%"></span>
      </div>
    </section>
  `).join("");
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
              <th>?交?</th>
              <th>瑼</th>
              <th>蝮質??/th>
              <th>隡啁???</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");
  const marketDetailSections = marketSummaries.map((item) => {
    const rows = item.rows.map((row) => {
      const quote = state.quotes[row.symbol];
      const price = quote?.price ?? null;
      const avgCost = Number(row.avgCost || 0);
      const perfRate = (price !== null && avgCost > 0)
        ? ((price - avgCost) / avgCost * 100)
        : null;
      const perfClass = perfRate === null ? "" : perfRate > 0 ? "perf-positive" : perfRate < 0 ? "perf-negative" : "";
      const priceCell = price !== null ? escapeHtml(formatNumber(price, 2)) : "<span class=\"muted-text\">??/span>";
      const perfCell = perfRate !== null
        ? `<span class="${perfClass}">${perfRate > 0 ? "+" : ""}${perfRate.toFixed(2)}%</span>`
        : "<span class=\"muted-text\">??/span>";
      return `
        <tr class="symbol-row" data-symbol="${escapeHtml(row.symbol)}" tabindex="0" style="cursor:pointer">
          <td>${escapeHtml(row.symbol)}</td>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(displayValue(row.shares))}</td>
          <td>${escapeHtml(displayValue(row.avgCost))}</td>
          <td>${priceCell}</td>
          <td>${perfCell}</td>
          <td>${escapeHtml(formatMoney(row.cost))}</td>
        </tr>
      `;
    }).join("");
    const quoteLoading = Object.keys(state.quotes).length === 0
      ? "<p class=\"muted-text quote-loading\">甇?頛?曉??/p>" : "";
    return `
      <section class="market-detail-section">
        <div class="card-heading">
          <h3>${marketLabel(item.market)}?敦</h3>
          <span>撱箄降瘞港? ${item.targetLevel === null ? "?芾身摰? : formatPercent(item.targetLevel)}</span>
        </div>
        ${quoteLoading}
        <div class="table-scroll compact-table">
          <table class="parsed-table">
            <thead>
              <tr>
                <th>隞??</th>
                <th>?迂</th>
                <th>?⊥</th>
                <th>?漱?</th>
                <th>?曉</th>
                <th>銵函??/th>
                <th>隡啁??</th>
              </tr>
            </thead>
            <tbody>${rows || "<tr><td colspan=\"7\">瘝?摨怠?</td></tr>"}</tbody>
          </table>
        </div>
        <div class="symbol-chart-panel" id="symbol-chart-${escapeHtml(item.market)}" hidden></div>
      </section>
    `;
  }).join("");
  const validDashboardTabs = new Set(["home", "holdings", "capture"]);
  if (!validDashboardTabs.has(state.dashboardTab)) state.dashboardTab = "home";
  const homeContent = `
    <div class="metric-grid">
      <div class="metric">
        <span>摨怠?瑼</span>
        <strong>${formatNumber(positions.length)}</strong>
      </div>
      <div class="metric">
        <span>蝮質??/span>
        <strong>${formatNumber(totalShares, 3)}</strong>
      </div>
      <div class="metric">
        <span>隡啁???</span>
        <strong>${formatMoney(totalCost)}</strong>
      </div>
      <div class="metric">
        <span>?脩垢敹怎</span>
        <strong>${formatNumber(state.cloudHistory.snapshots.length)}</strong>
      </div>
      <div class="metric">
        <span>甇瑕撱箄降瘞港?</span>
        <strong>${formatNumber(state.targetLevelHistory.length)}</strong>
      </div>
    </div>

    <div class="dashboard-grid">
      <section class="dashboard-card">
        <div class="card-heading">
          <h3>撣瘞港?</h3>
          <span>撱箄降瘞港??箏?撣摨怠??蜇鞈???靘?/span>
        </div>
        <div class="market-water-grid">${marketCards}</div>
      </section>

      <section class="dashboard-card">
        <div class="card-heading">
          <h3>餈嗾甈∪翰?扯隅??/h3>
          <span>蝬?箸??穿???箄??/span>
        </div>
        <div class="trend-chart">${trendBars || "<p class=\"muted-text\">撠甇瑕敹怎??/p>"}</div>
      </section>
    </div>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>撱箄降瘞港?頞典</h3>
        <span>?啗 / 蝢甇瑕撱箄降瘞港?嚗?嚗?/span>
      </div>
      ${renderTargetLevelChart(state.targetLevelHistory)}
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>瘥瘞港???撅?</h3>
        <span>蝚砌?蝑??摨怠?嚗?蝥誑隞摨怠?皜?銝隞賢翰??/span>
      </div>
      <div class="water-cost-chart">${renderWaterCostAnalysis(layoutAnalysis)}</div>
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>?芷敹怎</h3>
      </div>
      <div class="snapshot-delete-row">
        <input type="date" id="home-delete-snapshot-date">
        <select id="home-delete-snapshot-market">
          <option value="all">?????/option>
          <option value="TW">?啗</option>
          <option value="US">蝢</option>
        </select>
        <button id="home-delete-cloud-snapshot" class="button danger compact" type="button">?芷</button>
      </div>
      <p id="home-delete-snapshot-preview" class="snapshot-delete-preview">${escapeHtml(snapshotDeletePreviewText("", "all"))}</p>
    </section>
  `;
  const holdingsContent = `
    <section class="dashboard-card">
      <div class="card-heading">
        <h3>撣??⊥頞典</h3>
        <span>?啗 / 蝢瘥蝮賢?撅?⊥</span>
      </div>
      <div class="layout-shares-chart">${renderLayoutSharesChart(state.cloudHistory)}</div>
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>??⊥頞典</h3>
        <span>瘥?∠巨??豢?????暺?銝?敦??瑼粥??/span>
      </div>
      <div class="layout-shares-chart">${renderAllSymbolsChart(state.cloudHistory)}</div>
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>?瘥?⊥</h3>
        <span>?餈翰?抒???⊥??摨?</span>
      </div>
      ${renderDailyShareMatrix(layoutAnalysis)}
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>瘥撣??⊥撌桃</h3>
        <span>隞摨怠?皜?銝隞賢?撣敹怎</span>
      </div>
      ${renderLayoutDeltaTable(layoutAnalysis)}
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>?桀??敦</h3>
        <span>${positions.length} 蝑澈摮?靘?∟?蝢????????貉粥??/span>
      </div>
      <div class="market-detail-grid">${marketDetailSections}</div>
    </section>

    <section class="dashboard-card">
      <div class="card-heading">
        <h3>瘥摨怠?蝮質汗</h3>
        <span>?餈?${history.length} 甈⊿蝡臬翰?改?靘??游???/span>
      </div>
      ${dailyRowsByMarket || "<p class=\"muted-text\">撠甇瑕敹怎??/p>"}
      <div class="snapshot-actions">
        <button id="cleanup-duplicates" class="button secondary compact" type="button">皜???</button>
      </div>
    </section>
  `;
  const captureContent = `
    <section class="dashboard-card capture-tab-card">
      <div class="card-heading">
        <h3>?啣?摨怠??芸?</h3>
        <span>???芸??亙敺鞎潔????暹??豢?</span>
      </div>
      <p class="muted-text">蝣箄??芸?閫??敺??舐??雿萄??脩垢?神??Google Sheet嚗ashboard ???啗??交??啣澈摮?/p>
      <button id="dashboard-open-capture" class="button primary" type="button">?啣??芸?</button>
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
        <h2>?桀?摨怠?</h2>
        <p>${escapeHtml(cloud.snapshot.date)} 繚 ${marketLabel(cloud.snapshot.market)} 繚 ${escapeHtml(cloud.snapshot.createdAt)}</p>
      </div>
      <div class="dashboard-actions">
        <button id="dashboard-refresh" class="button secondary compact" type="button">??渡?</button>
      </div>
    </header>

    <div class="dashboard-tab-content">${tabContent}</div>
    <nav class="dashboard-tabs" role="tablist" aria-label="AssetFlow Invest">
      ${dashboardTabButton("home", "擐?")}
      ${dashboardTabButton("holdings", "摨怠?")}
      ${dashboardTabButton("capture", "?啣?")}
    </nav>
  `;
  els.cloudSnapshot.querySelector("#dashboard-refresh")?.addEventListener("click", () => loadLatestCloudSnapshot(true));
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
  const homeDeleteDate = els.cloudSnapshot.querySelector("#home-delete-snapshot-date");
  const homeDeleteMarket = els.cloudSnapshot.querySelector("#home-delete-snapshot-market");
  const homeDeletePreview = els.cloudSnapshot.querySelector("#home-delete-snapshot-preview");
  const updateHomeDeletePreview = () => {
    if (!homeDeletePreview || !homeDeleteDate || !homeDeleteMarket) return;
    homeDeletePreview.textContent = snapshotDeletePreviewText(homeDeleteDate.value, homeDeleteMarket.value);
  };
  homeDeleteDate?.addEventListener("change", updateHomeDeletePreview);
  homeDeleteMarket?.addEventListener("change", updateHomeDeletePreview);
  els.cloudSnapshot.querySelector("#home-delete-cloud-snapshot")?.addEventListener("click", () => deleteSelectedCloudSnapshots({ buttonId: "home-delete-cloud-snapshot", dateId: "home-delete-snapshot-date", marketId: "home-delete-snapshot-market" }));
  els.cloudSnapshot.querySelectorAll("[data-target-level-market]").forEach((input) => {
    input.addEventListener("change", () => {
      if (updateTargetLevel(input.dataset.targetLevelMarket, input.value)) {
        renderCloudSnapshot();
      }
    });
  });
  els.cloudSnapshot.querySelectorAll("[data-level-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.levelChartRange = btn.dataset.levelRange;
      renderCloudSnapshot();
    });
  });
  els.cloudSnapshot.querySelectorAll(".level-chart-container circle[data-tooltip]").forEach((dot) => {
    dot.style.cursor = "pointer";
    dot.addEventListener("click", (e) => {
      const container = dot.closest(".level-chart-container");
      let tip = container.querySelector(".chart-tooltip");
      if (!tip) { tip = document.createElement("div"); tip.className = "chart-tooltip"; container.appendChild(tip); }
      tip.textContent = dot.dataset.tooltip;
      tip.style.display = "block";
      setTimeout(() => { tip.style.display = "none"; }, 2500);
      e.stopPropagation();
    });
  });
  els.cloudSnapshot.querySelectorAll(".symbol-row").forEach((row) => {
    const activate = () => {
      const symbol = row.dataset.symbol;
      if (!symbol) return;
      const section = row.closest(".market-detail-section");
      const panel = section?.querySelector(".symbol-chart-panel");
      if (!panel) return;
      const isOpen = !panel.hidden && panel.dataset.activeSymbol === symbol;
      panel.hidden = isOpen;
      if (!isOpen) {
        panel.dataset.activeSymbol = symbol;
        const name = row.querySelector("td:nth-child(2)")?.textContent || symbol;
        const chartHtml = renderSymbolSharesChart(symbol, state.cloudHistory);
        panel.innerHTML = chartHtml
          ? `<div class="symbol-chart-heading"><strong>${escapeHtml(symbol)}</strong> ${escapeHtml(name)} ?⊥韏啣</div>${chartHtml}`
          : `<p class="muted-text">${escapeHtml(symbol)} 撠頞喳?甇瑕鞈???/p>`;
      }
    };
    row.addEventListener("click", activate);
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
  });
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
    button.textContent = "瑼Ｘ";
  }
  try {
    await ensureCloudSheetTables();
    const snapshotValues = await readCloudSheetValues(SHEET_NAMES.snapshots, "A2:H");
    const positionValues = await readCloudSheetValues(SHEET_NAMES.positions, "A2:J");
    const snapshots = parseSnapshotRows(stripHeaderRow(snapshotValues, SHEET_HEADERS.snapshots));
    const positions = parsePositionRows(stripHeaderRow(positionValues, SHEET_HEADERS.positions));
    const target = snapshots.find((snapshot) => snapshot.snapshotId === snapshotId);
    if (!target) {
      alert("??敹怎撌脖?摮嚗???渡???);
      await loadLatestCloudSnapshot(false);
      return;
    }
    const positionCount = positions.filter((row) => row.snapshotId === snapshotId).length;
    const confirmed = confirm([
      `蝣箏??芷 ${target.date} ${marketLabel(target.market)} 敹怎嚗,
      "",
      `${target.rowCount || positionCount} 瑼澈摮?繚 ${target.createdAt}`,
      "",
      "?芷敺??郊蝘駁??敹怎?澈摮?蝝啜?,
    ].join("\n"));
    if (!confirmed) return;

    if (button) button.textContent = "?芷";
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
    alert("撌脣?日蝡臬翰?扼?);
  } catch (error) {
    console.error(error);
    alert(error.message || "?芷?脩垢敹怎憭望?");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "?芷";
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
    alert("隢??豢?閬?斤??交???);
    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "瑼Ｘ銝?..";
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
      alert("???撣瘝??脩垢敹怎??);
      return;
    }

    const targetLines = targets
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((snapshot) => `- ${snapshot.date} ${marketLabel(snapshot.market)} 繚 ${snapshot.rowCount || 0} 瑼?繚 ${snapshot.createdAt}`)
      .join("\n");
    const confirmed = confirm([
      `蝣箏??芷 ${targets.length} 蝑翰?扯? ${targetPositionCount} 蝑澈摮?蝝堆?`,
      "",
      targetLines,
      "",
      "?芷敺??湔?神 Google Sheet ?蝡臬翰?扯???,
    ].join("\n"));
    if (!confirmed) return;

    if (button) button.textContent = "?芷銝?..";
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
    alert(`撌脣??${targets.length} 蝑蝡臬翰?扼);
  } catch (error) {
    console.error(error);
    alert(error.message || "?芷?脩垢敹怎憭望?");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "?芷敹怎";
    }
  }
}

async function cleanupDuplicateCloudSnapshots() {
  const button = els.cloudSnapshot?.querySelector("#cleanup-duplicates");
  if (button) {
    button.disabled = true;
    button.textContent = "瑼Ｘ銝?..";
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
      alert("瘝??曉???撣???批捆??銴翰?扼?);
      return;
    }

    const confirmed = confirm(`?曉 ${duplicateGroups.length} 蝯?銴翰?改?撠??${duplicateIds.size} 蝑??翰?扯??嗅澈摮?蝝堆?靽?瘥???啣遣蝡?銝隞賬Ⅱ摰???`);
    if (!confirmed) return;

    if (button) button.textContent = "皜?銝?..";
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
    alert(`撌脫???${duplicateIds.size} 蝑?銴翰?扼);
  } catch (error) {
    console.error(error);
    alert(error.message || "皜???敹怎憭望?");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "皜???";
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
    button.textContent = "閮箸銝?..";
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
    alert(error.message || "閮箸?臬憭望?嚗???渡?敺?閰?);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "?臬閮箸";
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
    alert("?遢?澆?銝迤蝣?);
    return;
  }
  const normalized = entries
    .filter((entry) => entry && entry.id && Array.isArray(entry.images))
    .map((entry) => ({
      ...entry,
      updatedAt: new Date().toISOString(),
    }));
  if (!normalized.length) {
    alert("?遢?扳???臬鞈?");
    return;
  }
  await txStore("readwrite", (store) => {
    normalized.forEach((entry) => store.put(entry));
  });
  state.entries = await getAllEntries();
  render();
  alert(`撌脣??${normalized.length} 蝑);
}

function bindEvents() {
  els.fileInput.addEventListener("change", (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  });
  els.backupInput.addEventListener("change", (event) => importBackup(event.target.files[0]));
  els.openCapture?.addEventListener("click", openCapturePanel);
  els.closeCapture?.addEventListener("click", closeCapturePanel);
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
  els.search.addEventListener("input", (event) => {
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
    els.authSignIn.textContent = "?餃銝?..";
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
    resetGoogleSession(error.message || "Google ?餃憭望?");
  } finally {
    authFlowInProgress = false;
    renderAuthGate();
  }
}

async function init() {
  const versionText = `AssetFlow Invest ${APP_VERSION} 繚 ${APP_VERSION_NOTE}`;
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
    registration.update?.();
  }).catch((error) => console.warn("service worker", error));
}

init().catch((error) => {
  console.error(error);
  alert("AssetFlow Invest ??憭望?");
});
