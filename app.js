const DB_NAME = "assetflow_invest_screenshots";
const DB_VERSION = 1;
const STORE = "entries";
const APP_VERSION = "v0.10.0";
const APP_VERSION_NOTE = "合併快照";
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
const LEGACY_GOOGLE_CLIENT_IDS = new Set([
  "320535010458-cccl087b251bejs1coa2oln1n6uddr35.apps.googleusercontent.com",
]);
const SHEET_SYNC_CONFIG_KEY = "assetflow_invest_sheet_sync";
const SHEET_NAMES = {
  snapshots: "AssetFlowSnapshots",
  positions: "AssetFlowPositions",
};
const SHEET_HEADERS = {
  snapshots: ["snapshot_id", "created_at", "date", "market", "source_entry_id", "source_title", "row_count", "app_version"],
  positions: ["snapshot_id", "date", "market", "symbol", "name", "kind", "shares", "avg_cost", "source", "created_at"],
};
const SYMBOL_NAMES = {
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
};

const state = {
  entries: [],
  draftImages: [],
  filter: "all",
  query: "",
  cloudSnapshot: null,
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
      : `${state.draftImages.length} 張截圖`;
  }
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
  els.list.innerHTML = "";
  els.empty.classList.toggle("is-hidden", entries.length > 0);
  els.summary.textContent = `${state.entries.length} 張截圖`;

  for (const entry of entries) {
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
        <p>${escapeHtml(entry.text || entry.note || entry.date)}</p>
      </div>
    `;
    card.addEventListener("click", () => openDetail(entry.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetail(entry.id);
      }
    });
    els.list.appendChild(card);
  }
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
      : `${base.title || "截圖"} ${index + 1}`,
    images: [image],
    parsedRows: image.parsedRows || base.parsedRows,
    ocrElapsedMs: image.ocrElapsedMs,
    columnOcrMs: image.columnOcrMs,
    rowOcrMs: image.rowOcrMs,
    columnCrops: image.columnCrops || [],
    rowCrops: image.rowCrops || [],
    skippedRowCrops: image.skippedRowCrops || [],
  }));

  await txStore("readwrite", (store) => {
    entries.forEach((entry) => store.put(entry));
  });

  state.entries.push(...entries);
  clearDraft();
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
  els.ocrStatus.textContent = "尚未解析";
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
        <button class="button secondary" type="button" data-action="mark-imported">標記已匯入</button>
        <button class="button primary" type="button" data-action="save-cloud-snapshot">存到 Google Sheet</button>
        <button class="button ghost danger" type="button" data-action="delete">刪除</button>
      </div>
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
  els.detailContent.querySelector('[data-action="mark-imported"]').addEventListener("click", () => updateStatus(id, "imported"));
  els.detailContent.querySelector('[data-action="save-cloud-snapshot"]').addEventListener("click", () => saveEntrySnapshotToGoogleSheet(id));
  els.detailContent.querySelector('[data-action="delete"]').addEventListener("click", () => deleteEntry(id));
  els.detailContent.querySelectorAll('[data-action="apply-symbol"]').forEach((button) => {
    button.addEventListener("click", () => {
      const rowIndex = Number(button.dataset.rowIndex);
      const input = els.detailContent.querySelector(`[data-symbol-input="${rowIndex}"]`);
      applyManualSymbol(id, rowIndex, input?.value || "");
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
  await ensureTesseract();
  const imageForOcr = await prepareImageForOcr(image, options);

  const attempts = [
    { lang: "chi_tra+eng", label: "繁中/英文" },
    { lang: "eng", label: "英文/數字備援" },
  ];
  const errors = [];

  const full = await recognizeDataUrl(imageForOcr.dataUrl, attempts, (progress, label) => {
    onProgress?.(progress, label);
  }, errors);

  if (full.text.trim()) {
    if (!options.columnOcr) {
      return {
        text: full.text,
        mode: full.mode,
        elapsedMs: Math.round(performance.now() - startedAt),
      };
    }

    const rowStartedAt = performance.now();
    const rowResult = await recognizeArkRows(imageForOcr.dataUrl, full.lines || [], (progress, label) => {
      onProgress?.(progress, label);
    });
    const rowRows = rowResult.rows || [];
    const fullRows = parseHoldings(full.text);
    const rows = rowRows.length ? dedupeRows(rowRows) : [];
    const rowText = renderRowOcrText(rowResult);

    return {
      text: [full.text.trim(), rowText].filter(Boolean).join("\n\n--- 橫列 OCR ---\n\n"),
      mode: `${full.mode} + 橫列裁切`,
      rows,
      elapsedMs: Math.round(performance.now() - startedAt),
      rowOcrMs: Math.round(performance.now() - rowStartedAt),
      rowCrops: rowResult.crops || [],
      skippedRowCrops: rowResult.skipped || [],
      fallbackRows: fullRows,
    };
  }

  throw new Error(`OCR 無法完成。${errors.join("；")}`);
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

async function recognizeArkRows(dataUrl, fullLines, onProgress) {
  const rects = await detectArkRowRects(dataUrl, fullLines);
  const attempts = [{ lang: "chi_tra+eng", label: "橫列" }];
  const rows = [];
  const crops = [];
  const skipped = [];

  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index];
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

  return { rows, crops, skipped };
}

async function detectArkRowRects(dataUrl) {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const left = 0.095;
  const right = 0.965;
  const separators = await detectArkRowSeparators(image);
  const minHeight = height * 0.052;
  const maxHeight = height * 0.145;
  const rects = rectsFromSeparators(separators, width, height, left, right, minHeight, maxHeight);

  return rects.length ? rects : fallbackArkRowRects(width, height, left, right);
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

async function applyManualSymbol(entryId, rowIndex, value) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry?.parsedRows?.[rowIndex]) return;

  const symbol = normalizeSymbolInput(value);
  if (!isTwSymbol(symbol)) {
    alert("請輸入有效代號，例如 0050、2330、00988A");
    return;
  }

  const row = entry.parsedRows[rowIndex];
  const officialName = lookupSymbolName(symbol);
  entry.parsedRows[rowIndex] = {
    ...row,
    symbol,
    name: officialName || row.ocrName || row.name || "",
    needsReview: !officialName,
    reviewReason: officialName ? "" : "名稱待補",
    manualSymbol: true,
  };
  entry.updatedAt = new Date().toISOString();
  await txStore("readwrite", (store) => store.put(entry));
  render();
  openDetail(entryId);
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
  setOcrStatus("載入 OCR 中...");
  try {
    const texts = [];
    for (let index = 0; index < state.draftImages.length; index += 1) {
      const image = state.draftImages[index];
      setOcrStatus(`解析第 ${index + 1}/${state.draftImages.length} 張`);
      const result = await recognizeImage(image, (progress, mode) => {
        setOcrStatus(`解析第 ${index + 1}/${state.draftImages.length} 張 ${progress}%（${mode}）`);
      }, {
        maskEditButtons: els.kind.value === "ark_position",
        columnOcr: els.kind.value === "ark_position",
      });
      texts.push(result.text.trim());
      if (Array.isArray(result.rows)) {
        image.parsedRows = result.rows;
        image.ocrElapsedMs = result.elapsedMs;
        image.columnOcrMs = result.columnOcrMs;
        image.rowOcrMs = result.rowOcrMs;
        image.columnCrops = result.columnCrops || [];
        image.rowCrops = result.rowCrops || [];
        image.skippedRowCrops = result.skippedRowCrops || [];
      }
    }
    const combinedText = texts.filter(Boolean).join("\n\n---\n\n");
    els.text.value = combinedText;
    const rows = state.draftImages.flatMap((image) => image.parsedRows || []);
    const parsedRows = rows.length ? dedupeRows(rows) : parseHoldings(els.text.value);
    const columnCrops = state.draftImages.flatMap((image) => image.columnCrops || []);
    const rowCrops = state.draftImages.flatMap((image) => image.rowCrops || []);
    const skippedRowCrops = state.draftImages.flatMap((image) => image.skippedRowCrops || []);
    els.parsePreview.innerHTML = renderParsedRows(parsedRows, "draft", "", columnCrops, rowCrops, skippedRowCrops);
    const elapsed = state.draftImages.reduce((sum, image) => sum + (image.ocrElapsedMs || 0), 0);
    setOcrStatus(parsedRows.length ? `完成，抓到 ${parsedRows.length} 筆候選庫存（${formatDuration(elapsed)}）` : `完成，未抓到庫存列（${formatDuration(elapsed)}）`);
  } catch (error) {
    console.error(error);
    setOcrStatus("解析失敗");
    alert(error.message || "截圖解析失敗，請重新整理後再試");
  } finally {
    els.parseDraft.disabled = state.draftImages.length === 0;
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

  const shares = numbers.find((value) => Number.isInteger(value) && value > 0) ?? null;
  const rawAvgCost = numbers.find((value) => value !== shares && value > 0) ?? null;
  const avgCost = normalizeArkAvgCost(rawAvgCost);
  if (shares === null || avgCost === null) return null;

  const symbol = findKnownSymbolInText(normalized);
  const officialName = lookupSymbolName(symbol);
  const beforeHolding = holdingIndex >= 0 ? normalized.slice(0, holdingIndex) : normalized;
  const ocrName = cleanArkNamePart(beforeHolding);

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

    const symbol = symbolInfo?.symbol || "";
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

function compactText(value) {
  return String(value || "").replace(/\s+/g, "");
}

function isTwSymbol(value) {
  return /^\d{4,6}[A-Z]?$/.test(String(value || "").trim());
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
    .replace(/現\s*股.*/, "")
    .replace(/\b\d{4,6}[A-Z]?\b/g, "")
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

function renderParsedRows(rows, context, entryId = "", columnCrops = [], rowCrops = [], skippedRowCrops = []) {
  const rowDiagnostics = renderRowCropDiagnostics(rowCrops, skippedRowCrops);
  if (!rows?.length) {
    const crops = rowDiagnostics || renderColumnCrops(columnCrops);
    if (crops) {
      return `
        <div class="${context === "detail" ? "detail-field" : "parsed-card"}">
          <span>解析庫存</span>
          <div class="pre-wrap">尚未抓到庫存列</div>
          ${crops}
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
      <td>${escapeHtml(row.symbol || "待確認")}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.kind || "")}</td>
      <td>${escapeHtml(displayValue(row.shares))}</td>
      <td>${escapeHtml(displayValue(row.avgCost))}</td>
      <td>${escapeHtml(row.needsReview ? row.reviewReason || "待確認" : "")}</td>
      <td>${renderSymbolFixCell(row, index, context, entryId)}</td>
      <td class="raw-cell">${escapeHtml(row.rawLine || "")}</td>
    </tr>
  `).join("");
  return `
    <div class="${context === "detail" ? "detail-field" : "parsed-card"}">
      <span>解析庫存</span>
      <div class="table-scroll">
        <table class="parsed-table">
          <thead>
            <tr>
              <th>截圖</th>
              <th>代號</th>
              <th>名稱</th>
              <th>種類</th>
              <th>股數</th>
              <th>成交均價</th>
              <th>狀態</th>
              <th>修正</th>
              <th>OCR 區塊</th>
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
      <img src="${row.crop.dataUrl}" alt="${escapeHtml(row.crop.label || "個股橫列裁切")}">
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

  return `
    <div class="row-diagnostics" aria-label="個股橫列裁切診斷">
      ${items}
    </div>
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

function renderSymbolFixCell(row, index, context, entryId) {
  if (context !== "detail" || !entryId || !row.needsReview) return "";
  return `
    <div class="symbol-fix">
      <input data-symbol-input="${index}" type="text" inputmode="text" placeholder="代號" value="${escapeHtml(row.symbol || "")}">
      <button class="button secondary compact" type="button" data-action="apply-symbol" data-row-index="${index}">套用</button>
    </div>
  `;
}

function closeDetail() {
  els.detail.classList.remove("is-open");
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
  return sheetsFetch(`/values/${sheetRange(sheetName, range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ majorDimension: "ROWS", values }),
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
    alert("目前沒有已確認或已匯入的方舟庫存截圖可合併。");
    return;
  }
  if (!rows.length) {
    alert("已確認截圖中沒有可合併的庫存列。請先確認 OCR 解析結果與股票代號。");
    return;
  }
  if (conflicts.length) {
    alert(`合併快照發現同代號衝突，請先修正後再存：\n\n${conflicts.slice(0, 8).join("\n")}`);
    return;
  }

  const confirmed = confirm(`將 ${candidates.length} 張方舟庫存截圖合併成 1 個雲端快照，共 ${rows.length} 筆庫存。確定寫入 Google Sheet？`);
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
    const markets = [...new Set(candidates.map((item) => item.entry.market).filter(Boolean))];
    const payload = buildSnapshotPayloadFromRows({
      snapshotId: snapshotId(createdAt),
      createdAt,
      date: latestDate,
      market: markets.length === 1 ? markets[0] : "ALL",
      sourceEntryId: candidates.map((item) => item.entry.id).join(","),
      sourceTitle: `合併快照：${candidates.length} 張截圖`,
      rows,
    });

    await ensureCloudSheetTables();
    await appendSheetValues(SHEET_NAMES.snapshots, "A:H", [payload.snapshotRow]);
    await appendSheetValues(SHEET_NAMES.positions, "A:J", payload.positionRows);

    for (const item of candidates) {
      item.entry.status = "imported";
      item.entry.sheetSnapshotId = payload.snapshotId;
      item.entry.updatedAt = createdAt;
    }
    await txStore("readwrite", (store) => {
      candidates.forEach((item) => store.put(item.entry));
    });
    state.entries = await getAllEntries();
    await loadLatestCloudSnapshot(false);
    render();
    alert(`已合併存到 Google Sheet：${rows.length} 筆庫存`);
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
  const payload = buildSnapshotPayload(entry);
  if (!payload.positionRows.length) {
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
    await appendSheetValues(SHEET_NAMES.snapshots, "A:H", [payload.snapshotRow]);
    await appendSheetValues(SHEET_NAMES.positions, "A:J", payload.positionRows);
    entry.status = "imported";
    entry.sheetSnapshotId = payload.snapshotId;
    entry.updatedAt = new Date().toISOString();
    await txStore("readwrite", (store) => store.put(entry));
    await loadLatestCloudSnapshot(false);
    render();
    openDetail(id);
    alert(`已存到 Google Sheet：${payload.positionRows.length} 筆庫存`);
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
    date: row[2] || "",
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
    date: row[1] || "",
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

async function loadLatestCloudSnapshot(showAlert = true) {
  try {
    await ensureCloudSheetTables();
    const snapshotValues = await readCloudSheetValues(SHEET_NAMES.snapshots, "A2:H");
    const snapshots = parseSnapshotRows(stripHeaderRow(snapshotValues, SHEET_HEADERS.snapshots)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (!snapshots.length) {
      state.cloudSnapshot = null;
      renderCloudSnapshot();
      if (showAlert) alert("Google Sheet 目前還沒有庫存快照。");
      return;
    }
    const latest = snapshots[0];
    const positionValues = await readCloudSheetValues(SHEET_NAMES.positions, "A2:J");
    const positions = parsePositionRows(stripHeaderRow(positionValues, SHEET_HEADERS.positions)).filter((row) => row.snapshotId === latest.snapshotId);
    state.cloudSnapshot = { snapshot: latest, positions };
    renderCloudSnapshot();
    if (showAlert) alert(`已讀取雲端庫存：${positions.length} 筆`);
  } catch (error) {
    console.error(error);
    if (showAlert) alert(error.message || "讀取 Google Sheet 失敗");
  }
}

function stripHeaderRow(values, headers) {
  if (!values?.length) return [];
  const first = values[0].map((value) => String(value || "").trim());
  const sameHeader = headers.every((header, index) => first[index] === header);
  return sameHeader ? values.slice(1) : values;
}

function renderCloudSnapshot() {
  if (!els.cloudSnapshot) return;
  const cloud = state.cloudSnapshot;
  if (!cloud?.snapshot) {
    els.cloudSnapshot.innerHTML = "";
    return;
  }
  const rows = cloud.positions.map((row) => `
    <tr>
      <td>${escapeHtml(row.symbol)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(displayValue(row.shares))}</td>
      <td>${escapeHtml(displayValue(row.avgCost))}</td>
    </tr>
  `).join("");
  els.cloudSnapshot.innerHTML = `
    <header>
      <div>
        <h2>雲端庫存</h2>
        <p>${escapeHtml(cloud.snapshot.date)} · ${marketLabel(cloud.snapshot.market)} · ${escapeHtml(cloud.snapshot.createdAt)}</p>
      </div>
      <p>${cloud.positions.length} 筆</p>
    </header>
    <div class="table-scroll">
      <table class="parsed-table">
        <thead>
          <tr>
            <th>代號</th>
            <th>名稱</th>
            <th>股數</th>
            <th>成交均價</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
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
  els.fileInput.addEventListener("change", (event) => addFiles(event.target.files));
  els.backupInput.addEventListener("change", (event) => importBackup(event.target.files[0]));
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
    if (files.length) addFiles(files);
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

async function signInAndLoadApp() {
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
    renderAuthGate();
  }
}

async function init() {
  if (els.appVersion) {
    els.appVersion.textContent = `AssetFlow Invest ${APP_VERSION} · ${APP_VERSION_NOTE}`;
  }
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
    refreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.register("./sw.js").then((registration) => {
    registration.update?.();
  }).catch((error) => console.warn("service worker", error));
}

init().catch((error) => {
  console.error(error);
  alert("AssetFlow Invest 啟動失敗");
});
