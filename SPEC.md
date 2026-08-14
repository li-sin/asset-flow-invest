# AssetFlow Invest — 需求規格

> 專案筆記在 Obsidian vault：`1 🌱 Life/📁 Plans/📈 InvestAssistant/`
> 程式碼索引見 vault 的 `ai-quickref.md`；踩坑與根因見 `log.md`。

## 文件說明

- 功能編號：`F01`, `F02`...
- 驗收條件：`AC1`, `AC2`...（可用作測試函數命名依據，如 `test_F06_AC1_...`）
- 對應測試：標注現有測試檔；⚠️ = 無自動化測試，需手動驗證

**狀態欄**：✅ 使用中／⏸️ 程式還在但已不使用／🚧 未併 main／💀 死碼（定義了但無呼叫點）

**可測性**：🟢 純邏輯（可寫單元測試）／🟡 需 Sheet API（要 mock 或整合測試）／⚪ 純 UI（只能手動驗）

**壞掉的後果**：🔴 資料損毀不可逆／🟠 數字錯誤會誤導決策／⚫ 體驗問題

---

## 核對紀錄

**2026-08-14（session 41）建立**，對照 app.js v0.43.1（`1673784`）逐項 grep 核對，非憑文件推斷。

核對時發現三處文件與程式碼不符，已在下方反映：

1. **README 的 Tab 說明表漏了一個子分頁**。庫存實際有四個（`detail`/`refill`/`layout`/`delete`），README 只寫三個，漏掉「每日布局」（F32）。
2. **`ai-quickref.md` 寫 app.js「7500+ 行」，實際 9306 行**。
3. **app.js 有 20 個死碼函式**（定義了但全檔無呼叫點）。其中 `arkRefillChanged` 在 v0.43.0 就已是死碼，不是 v0.43.1 造成的。OCR 相關佔 5 個，另有 4 個 render 函式對應已從 UI 移除的功能。

**AC 尚未定義。** 這份是骨架，功能清單已核實，驗收條件待逐項補上。補的順序建議跟著「🟢＋🔴」走，那是最該先有自動化測試的地方。

---

## Module A：資料輸入（C 新增 tab）

`captureMode` 四種模式：`broker` / `ocr` / `paste` / `manual`

| F | 功能 | 關鍵函式 | 狀態 | 可測 | 後果 | 現有測試 |
|---|---|---|---|---|---|---|
| F01 | 券商檔匯入（永豐 xlsx，自架 fflate 解壓） | `readXlsxRows` / `parseSinopacHoldings` | ✅ | 🟢 | 🟠 | ⚠️ |
| F02 | 貼上表格解析（方舟兩種版面） | `parseLiveTextArk` / `parseColumnArk` | ✅ | 🟢 | 🟠 | `test_parser.mjs` 15 項 |
| F03 | 美股 Firstrade 持倉貼上（跳統計行、單位成本＝均價） | `parsePasteTable` | ✅ | 🟢 | 🟠 | ⚠️ |
| F04 | 手動逐欄輸入＋自動帶入兩市場最新持倉 | `prefillManualFromLatest` / `saveManualSnapshot` | ✅ | 🟢 | 🟠 | ⚠️ |
| F05 | 代號正規化（補 `00`，僅限字典內） | `normalizeTWSymbol` | ✅ | 🟢 | 🟠 | ⚠️ |
| F06 | **市場判定與拆分**（代號優先，一表兩市場） | `classifySymbolMarket` / `splitRowsByMarket` | ✅ | 🟢 | 🔴 | 有設計未進 repo（28 項） |
| F07 | 截圖 OCR（Tesseract 瀏覽器端） | `Tesseract` 相關 | ⏸️ | ⚪ | ⚫ | ⚠️ |

> F07 註：UI 入口仍在（index.html「解析截圖」鈕、`captureMode === "ocr"`），但主線輸入已換成 F01/F03，Sin 不再使用。相關的 `recognizeArkColumns`／`renderColumnOcrText`／`parseDraftImageWithRowLines`／`parseColumnOcrRows`／`marketFromText` 已是死碼。

## Module B：資料寫入與同步（無 UI，底層）

| F | 功能 | 關鍵函式 | 狀態 | 可測 | 後果 | 現有測試 |
|---|---|---|---|---|---|---|
| F08 | 快照寫入（同日同市場列差異→詢問取代） | `writeMarketSnapshotPayloads` | ✅ | 🟡 | 🔴 | ⚠️ |
| F09 | 防重複存檔（in-flight 旗標＋寫入前刷新索引） | `snapshotSaveInFlight` / `refreshSnapshotIndexFromSheet` | ✅ | 🟡 | 🔴 | ⚠️ |
| F10 | 布局 delta 寫入（含「前一份有、這次消失＝賣光」歸零列） | `saveLayoutDeltaToSheet` | ✅ | 🟢 | 🔴 | ⚠️ |
| F11 | 快照刪除／改日期後同步 layout（移孤兒列、重算後續） | `syncLayoutAfterSnapshotChange` | ✅ | 🟡 | 🔴 | ⚠️ |
| F12 | **首次布局日合併寫入**（先寫後清尾、讀不到雲端就不寫） | `writeFirstBuyDatesToSheet` | ✅ | 🟢 | 🔴 | 有設計未進 repo（23 項） |
| F13 | 建議快照日期（分市場、盤前退一天、退週五） | `suggestSnapshotTarget` / `marketTargetDates` | ✅ | 🟢 | ⚫ | 有設計未進 repo（18 項） |
| F14 | 存檔前明示「將存為 N 筆 · 日期」＋兩種琥珀提醒 | `saveTargetHint` | ✅ | 🟢 | ⚫ | ⚠️ |
| F15 | 補存前一天防呆（已過該市場開盤時 confirm） | `staleSnapshotDateWarning` | ✅ | 🟢 | 🟠 | ⚠️ |
| F16 | **RAW 寫入型別**（數字欄必須傳 float，否則 SUMIFS 靜默歸零） | `toNum` | ✅ | 🟢 | 🔴 | ⚠️ |
| F17 | **日期基準固定台北 UTC+8** | `taipeiNow` / `today` | ✅ | 🟢 | 🔴 | ⚠️ |

> F16 註：曾兩度造成資料污染（2026-07-15／07-16，共修 439+488 列）。污染源是「Sheet GET 讀回一律字串 → 原樣 RAW 整表寫回」，同模式的新程式碼一律要比照 `toNum()` 數值化。

## Module C：方舟回填助手（庫存子分頁 `refill`）

| F | 功能 | 關鍵函式 | 狀態 | 可測 | 後果 | 現有測試 |
|---|---|---|---|---|---|---|
| F18 | 待回填判定（雲端上次回填值 vs 最新快照） | `arkRefillDiff` | ✅ | 🟢 | 🟠 | 有設計未進 repo（30 項） |
| F19 | 本機回填進度失效條件（`done` 遇股數變動降級） | `renderArkRefill` 內 `phaseStale` | ✅ | 🟢 | 🟠 | 同上 |
| F20 | 均價容差（碎股重算不列待辦） | `arkAvgTolerance` | ✅ | 🟢 | ⚫ | 同上 |
| F21 | 兩段式複製（①股數→②均價→自動跳下一支） | `handleArkCopy` / `scrollToNextArkRefill` | ✅ | ⚪ | ⚫ | ⚠️ |
| F22 | 清倉偵測＋完成／重做（當天顯示、隔天消失） | `handleArkClearedDone` / `handleArkClearedRedo` | ✅ | 🟢 | 🟠 | ⚠️ |
| F23 | 跨裝置同步（`AssetFlowRefillState` 讀寫） | `loadRefillStateFromSheet` / `writeRefillEntryToSheet` | ✅ | 🟡 | 🟠 | ⚠️ |
| F24 | 歷史快照回填警示（**必須分市場判斷**） | `latestSnapshotDateForMarket` | ✅ | 🟢 | 🟠 | ⚠️ |
| F25 | 救援：↻ 重填／重做／清除進度 | `handleArkForceRefill` | ✅ | 🟢 | ⚫ | ⚠️ |

> `arkRefillChanged` 為 💀 死碼（v0.43.0 起無呼叫點），保留未清。

## Module D：庫存明細與快照管理（庫存子分頁 `detail`／`layout`／`delete`）

| F | 功能 | 關鍵函式 | 狀態 | 可測 | 後果 | 現有測試 |
|---|---|---|---|---|---|---|
| F26 | 明細表＋欄位升降冪排序＋損益率 delta | `renderCloudSnapshot` 內 | ✅ | ⚪ | ⚫ | ⚠️ |
| F27 | **編輯模式**（改代號／股數／均價／末列新增）＋ layout 重算 | `savePositionEdits` / `recalcLayoutAfterPositionEdit` | ✅ | 🟡 | 🔴 | ⚠️ |
| F28 | 首次布局日 set/edit＋批次補填 | `saveFirstBuyDate` | ✅ | 🟡 | 🟠 | ⚠️ |
| F29 | 損益率／表現率計算（表現率＝損益率÷持有天數） | `renderCloudSnapshot` 內 | ✅ | 🟢 | 🟠 | ⚠️ |
| F30 | 均價待補提醒（股數>0 但均價≤0） | `pendingAvgCostRows` | ✅ | 🟢 | 🟠 | ⚠️ |
| F31 | 個股走勢圖 | `renderTimedSvg` | ✅ | ⚪ | ⚫ | ⚠️ |
| F32 | **每日布局矩陣**（含市場 guard、已清倉隱藏、點欄頭排序） | `renderDailyShareMatrix` | ✅ | 🟢 | 🟠 | ⚠️ |
| F33 | 快照管理（月曆選日→改日期／刪除） | `renderCloudSnapshotSwipeList` | ✅ | 🟡 | 🔴 | ⚠️ |
| F34 | 修正代號（補救歷史髒代號）＋預覽 dry-run | `fixSheetSymbols` | 🚧 | 🟢 | ⚫ | branch 上 12 項 |

> F32 是 README Tab 說明表漏掉的子分頁。
> F34 的兩表版本（含 `AssetFlowLayout`）在 branch `fix/symbol-normalize-layout`，刻意未併 main（Sheet 實查 0 筆髒代號、OCR 已停用）。

## Module E：首頁分析（`homeSubTab`：overview／alerts／analysis）

| F | 功能 | 關鍵函式 | 狀態 | 可測 | 後果 | 現有測試 |
|---|---|---|---|---|---|---|
| F35 | 頂部四格統計（成本／市值／未實現／本月已實現，全台幣） | `renderCloudSnapshot` 內 | ✅ | 🟢 | 🟠 | ⚠️ |
| F36 | 市場水位卡＋更新水位（可寫指定日期） | `saveTargetLevelToSheet` | ✅ | 🟡 | 🟠 | ⚠️ |
| F37 | 建議水位趨勢圖 | `renderTimedSvg` | ✅ | ⚪ | ⚫ | ⚠️ |
| F38 | **待關注調節**（價格報酬率回歸：趨勢轉弱／跑輸大盤） | `ADJUST_TREND_COLORS` 區塊 | ✅ | 🟢 | 🟠 | ⚠️ |
| F39 | 整合趨勢圖＋今日預估＋點列/點圖外聚焦 | `renderAdjustTrendChart` | ✅ | ⚪ | ⚫ | ⚠️ |
| F40 | 損益趨勢圖（時間比例 X 軸、1M/3M/ALL） | `renderTimedSvg` | ✅ | ⚪ | ⚫ | ⚠️ |
| F41 | 損益率排名前三／後三 | `renderCloudSnapshot` 內 | ✅ | 🟢 | ⚫ | ⚠️ |
| F42 | 個股損益貢獻 bar／兩張散點圖／損益率分布直方圖 | `buildScatterSvg` 等 | ✅ | ⚪ | ⚫ | ⚠️ |
| F43 | 報價取得（台股加 `.TW` 送 proxy，存入時剝除） | `fetchQuotes` | ✅ | 🟢 | 🟠 | ⚠️ |

> 已從 UI 移除但函式仍在（💀 死碼）：`renderWaterCostAnalysis`／`renderLayoutDeltaTable`／`renderLayoutSharesChart`／`renderAllSymbolsChart`。

## Module F：月績效與現金試算（`homeSubTab: monthly`）

| F | 功能 | 關鍵函式 | 狀態 | 可測 | 後果 | 現有測試 |
|---|---|---|---|---|---|---|
| F44 | **月績效讀寫**（只寫 B/D/F＋補 C 欄公式，**E/G 絕不碰**） | `saveMonthlyPerf` | ✅ | 🟡 | 🔴 | ⚠️ |
| F45 | 多年 tab 支援＋未建年份一鍵建表 | `createPerfYearTab` | ✅ | 🟡 | 🟠 | ⚠️ |
| F46 | 跨 Sheet 讀 BudgetAssistant 月度帳本 | `BUDGET_SHEET_ID` | ✅ | 🟡 | ⚫ | ⚠️ |
| F47 | 現金需求試算（平均月支出→6 個月緩衝＋未來 12 個月計畫） | 月績效區塊內 | ✅ | 🟢 | ⚫ | ⚠️ |
| F48 | 現金計畫 tab 讀寫（全覆寫、保留 header） | `loadCashPlan` | ✅ | 🟡 | 🟠 | ⚠️ |

## Module G：基礎設施

| F | 功能 | 關鍵函式 | 狀態 | 可測 | 後果 | 現有測試 |
|---|---|---|---|---|---|---|
| F49 | Google OAuth 登入＋帳號白名單 | `signInAndLoadApp` / `DEFAULT_AUTHORIZED_EMAILS` | ✅ | 🟡 | 🔴 | ⚠️ |
| F50 | 重整免重登（token 效期內恢復 session） | `tryRestoreGoogleSession` | ✅ | 🟡 | ⚫ | ⚠️ |
| F51 | PWA／Service Worker 更新（no-store 繞 HTTP 快取） | `sw.js` | ✅ | ⚪ | 🟠 | ⚠️ |
| F52 | 備份匯出／匯入（IndexedDB 完整備份） | topbar「⋯ 更多」 | ✅ | 🟡 | 🟠 | ⚠️ |
| F53 | 本機開發貼 token 模式（僅 localhost 顯示） | `applyDevToken` | ✅ | 🟡 | ⚫ | ⚠️ |

---

## 測試現況總結

| | 項數 | 說明 |
|---|---|---|
| repo 內測試 | 15 | 只有 `test_parser.mjs`（F02） |
| 有設計但未進 repo | 111 | 散在 scratchpad 五個檔案，隨 session 目錄流失 |
| **實際回歸防護** | **0** | **所有測試都是把 app.js 邏輯複製一份再測，改壞 app.js 測試照樣全過** |

app.js 是瀏覽器 script（第 7 行就有 `document.getElementById`，無 export），node 無法直接 import，所以測試只能複製邏輯。要有真正的回歸防護，得先把純邏輯抽成可 import 的模組。

**建議優先補 AC 與測試的五項**（🟢 可測 ＋ 🔴 後果嚴重）：F06、F10、F12、F16、F17。其中 F06、F12 已有現成測試設計，只差接上真程式碼。
