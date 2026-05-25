const DB_NAME = "assetflow_invest_screenshots";
const DB_VERSION = 1;
const STORE = "entries";
const APP_VERSION = "v0.5.1";
const APP_VERSION_NOTE = "重新解析覆蓋舊資料";
const OCR_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const OCR_WORKER_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js";
const OCR_CORE_URL = "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js";
const OCR_LANG_PATH = "https://tessdata.projectnaptha.com/4.0.0";
const HEIC_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";

const state = {
  entries: [],
  draftImages: [],
  filter: "all",
  query: "",
};

const $ = (selector) => document.querySelector(selector);

const els = {
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
  appVersion: $("#app-version"),
  detail: $("#detail-panel"),
  detailContent: $("#detail-content"),
  closeDetail: $("#close-detail"),
};

let dbPromise = null;
let tesseractLoadPromise = null;
let heicLoadPromise = null;

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
      <div class="detail-grid">
        <div class="detail-field"><span>建立時間</span><strong>${new Date(entry.createdAt).toLocaleString()}</strong></div>
        <div class="detail-field"><span>檔名</span><strong>${escapeHtml(entry.images[0]?.name || "")}</strong></div>
      </div>
      <div class="detail-field">
        <span>擷取文字 / 手動補資料</span>
        <div class="pre-wrap">${escapeHtml(entry.text || "尚未填寫")}</div>
      </div>
      ${renderParsedRows(entry.parsedRows || parseHoldings(entry.text || ""), "detail")}
      <div class="detail-field">
        <span>備註</span>
        <div class="pre-wrap">${escapeHtml(entry.note || "尚未填寫")}</div>
      </div>
      <div class="form-actions">
        <button class="button secondary" type="button" data-action="parse-entry">重新解析截圖</button>
        <button class="button secondary" type="button" data-action="mark-reviewed">標記已確認</button>
        <button class="button secondary" type="button" data-action="mark-imported">標記已匯入</button>
        <button class="button ghost danger" type="button" data-action="delete">刪除</button>
      </div>
    </div>
  `;
  els.detail.classList.add("is-open");

  els.detailContent.querySelector('[data-action="parse-entry"]').addEventListener("click", () => parseExistingEntry(id));
  els.detailContent.querySelector('[data-action="mark-reviewed"]').addEventListener("click", () => updateStatus(id, "reviewed"));
  els.detailContent.querySelector('[data-action="mark-imported"]').addEventListener("click", () => updateStatus(id, "imported"));
  els.detailContent.querySelector('[data-action="delete"]').addEventListener("click", () => deleteEntry(id));
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

async function recognizeImage(image, onProgress) {
  await ensureTesseract();
  const imageForOcr = await prepareImageForOcr(image);

  const attempts = [
    { lang: "chi_tra+eng", label: "繁中/英文" },
    { lang: "eng", label: "英文/數字備援" },
  ];
  const errors = [];

  for (const attempt of attempts) {
    try {
      const result = await window.Tesseract.recognize(imageForOcr.dataUrl, attempt.lang, {
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
      if (text.trim()) {
        return { text, mode: attempt.label };
      }
      errors.push(`${attempt.label}: 沒有辨識到文字`);
    } catch (error) {
      errors.push(`${attempt.label}: ${error.message || error}`);
    }
  }

  throw new Error(`OCR 無法完成。${errors.join("；")}`);
}

async function prepareImageForOcr(image) {
  if (!isHeicImage(image)) return image;
  const dataUrl = await convertHeicToPngDataUrl(image);
  return {
    ...image,
    dataUrl,
    type: "image/png",
    convertedFrom: image.convertedFrom || "heic",
  };
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
      });
      texts.push(result.text.trim());
    }
    const combinedText = texts.filter(Boolean).join("\n\n---\n\n");
    els.text.value = combinedText;
    const rows = parseHoldings(els.text.value);
    els.parsePreview.innerHTML = renderParsedRows(rows, "draft");
    setOcrStatus(rows.length ? `完成，抓到 ${rows.length} 筆候選庫存` : "完成，未抓到庫存列");
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
    });
    entry.text = result.text.trim();
    entry.parsedRows = parseHoldings(entry.text);
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
    const shares = numbers.find((item) => Number.isInteger(item.value) && Math.abs(item.value) >= 1)?.value ?? null;
    const percent = numbers.find((item) => item.percent)?.value ?? null;
    const nonPercentNumbers = numbers.filter((item) => !item.percent);
    const firstPriceIndex = shares === null ? 0 : Math.max(0, nonPercentNumbers.findIndex((item) => item.value === shares) + 1);

    rows.push({
      symbol,
      name: nameTokens.join(" "),
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

function displayValue(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return `${value}${suffix}`;
}

function renderParsedRows(rows, context) {
  if (!rows?.length) {
    return context === "detail"
      ? `<div class="detail-field"><span>解析庫存</span><div class="pre-wrap">尚未抓到庫存列</div></div>`
      : "";
  }
  const body = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.symbol)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(displayValue(row.shares))}</td>
      <td>${escapeHtml(displayValue(row.avgCost))}</td>
      <td>${escapeHtml(displayValue(row.currentPrice))}</td>
      <td>${escapeHtml(displayValue(row.pnl))}</td>
      <td>${escapeHtml(displayValue(row.pnlRate, row.pnlRate === null ? "" : "%"))}</td>
    </tr>
  `).join("");
  return `
    <div class="${context === "detail" ? "detail-field" : "parsed-card"}">
      <span>解析庫存</span>
      <div class="table-scroll">
        <table class="parsed-table">
          <thead>
            <tr>
              <th>代號</th>
              <th>名稱</th>
              <th>股數</th>
              <th>成本</th>
              <th>現價</th>
              <th>損益</th>
              <th>損益率</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
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

async function init() {
  if (els.appVersion) {
    els.appVersion.textContent = `AssetFlow Invest ${APP_VERSION} · ${APP_VERSION_NOTE}`;
  }
  els.date.value = today();
  bindEvents();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("service worker", error));
  }
  state.entries = await getAllEntries();
  render();
}

init().catch((error) => {
  console.error(error);
  alert("AssetFlow Invest 啟動失敗");
});
