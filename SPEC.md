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

**AC 已定義 13 項**（2026-08-15，依 log.md 除蟲紀錄補齊）：高優先 9 項（F06／F08／F10／F11／F12／F16／F17／F18／F44）＋中優先 2 項（F09／F43）＋低優先 2 項（F13／F32）。其餘功能 AC 待逐項補上。

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
| F06 | **市場判定與拆分**（代號優先，一表兩市場） | `classifySymbolMarket` / `splitRowsByMarket` | ✅ | 🟢 | 🔴 | `test_market_split.mjs` 36 項 ✅ |
| F07 | 截圖 OCR（Tesseract 瀏覽器端） | `Tesseract` 相關 | ⏸️ | ⚪ | ⚫ | ⚠️ |

> F07 註：UI 入口仍在（index.html「解析截圖」鈕、`captureMode === "ocr"`），但主線輸入已換成 F01/F03，Sin 不再使用。相關的 `recognizeArkColumns`／`renderColumnOcrText`／`parseDraftImageWithRowLines`／`parseColumnOcrRows`／`marketFromText` 已是死碼。

### F06 驗收條件 — ✅ 4/4 AC 有自動化測試

- **AC1**：台股代號（`0050`、`00830`、`2327` 等數字開頭）→ 判定 `TW` — ✅ `test_market_split.mjs`
- **AC2**：美股代號（`AAPL`、`TSLA` 等字母開頭）→ 判定 `US` — ✅ `test_market_split.mjs`
- **AC3**：一份輸入同時含台股＋美股 → `splitRowsByMarket` 拆成兩份獨立 payload — ✅ `test_market_split.mjs`
- **AC4**：拆分後各 payload 的代號、股數、均價與原始資料一致（不丟列、不混市場） — ✅ `test_market_split.mjs`

> 歷史教訓（session 40）：`splitRowsByMarket` 曾把使用者選的市場當最高優先、代號判定是死路徑，導致美股資料被強制歸台股 → 四環節連鎖刪掉 6 支台股首次布局日。

## Module B：資料寫入與同步（無 UI，底層）

| F | 功能 | 關鍵函式 | 狀態 | 可測 | 後果 | 現有測試 |
|---|---|---|---|---|---|---|
| F08 | 快照寫入（同日同市場列差異→詢問取代） | `writeMarketSnapshotPayloads` | ✅ | 🟡 | 🔴 | ⚠️ |
| F09 | 防重複存檔（in-flight 旗標＋寫入前刷新索引） | `snapshotSaveInFlight` / `refreshSnapshotIndexFromSheet` | ✅ | 🟡 | 🔴 | ⚠️ |
| F10 | 布局 delta 寫入（含「前一份有、這次消失＝賣光」歸零列） | `saveLayoutDeltaToSheet` | ✅ | 🟢 | 🔴 | ⚠️ |
| F11 | 快照刪除／改日期後同步 layout（移孤兒列、重算後續） | `syncLayoutAfterSnapshotChange` | ✅ | 🟡 | 🔴 | ⚠️ |
| F12 | **首次布局日合併寫入**（先寫後清尾、讀不到雲端就不寫） | `writeFirstBuyDatesToSheet` | ✅ | 🟢 | 🔴 | `test_firstbuy_merge.mjs` 27 項 ✅ |
| F13 | 建議快照日期（分市場、盤前退一天、退週五） | `suggestSnapshotTarget` / `marketTargetDates` | ✅ | 🟢 | ⚫ | 有設計未進 repo（18 項） |
| F14 | 存檔前明示「將存為 N 筆 · 日期」＋兩種琥珀提醒 | `saveTargetHint` | ✅ | 🟢 | ⚫ | ⚠️ |
| F15 | 補存前一天防呆（已過該市場開盤時 confirm） | `staleSnapshotDateWarning` | ✅ | 🟢 | 🟠 | ⚠️ |
| F16 | **RAW 寫入型別**（數字欄必須傳 float，否則 SUMIFS 靜默歸零） | `toNum` | ✅ | 🟢 | 🔴 | `test_tonum.mjs` 15 項 ✅ |
| F17 | **日期基準固定台北 UTC+8** | `taipeiNow` / `today` | ✅ | 🟢 | 🔴 | `test_datetime.mjs` 4 項 ✅ |

> F16 註：曾兩度造成資料污染（2026-07-15／07-16，共修 439+488 列）。污染源是「Sheet GET 讀回一律字串 → 原樣 RAW 整表寫回」，同模式的新程式碼一律要比照 `toNum()` 數值化。

### F08 驗收條件 — ⚠️ 0/3 AC 有自動化測試

- **AC1**：連點/並發呼叫只產生一筆快照（`snapshotSaveInFlight` 擋住第二次） — ⚠️ 需 API mock
- **AC2**：寫入前必刷新雲端索引（`refreshSnapshotIndexFromSheet`），不得用過期 state 比對重複 — ⚠️ 需 API mock
- **AC3**：payload 的 date 和 market 不得為 undefined，否則不寫入 — ⚠️ 需 API mock

> 歷史教訓（session 36）：iOS 連點觸發兩次並發，兩次都用舊 state 查不到既有快照，各 append 一份。（session 24）：`payload.date`/`.market` 解構到 undefined，寫出空白日期列被所有篩選靜默過濾。

### F09 驗收條件 — ⚠️ 0/2 AC 有自動化測試

- **AC1**：寫入中按鈕 disable + 文字顯示「寫入中...」 — ⚠️ 純 UI
- **AC2**：所有儲存路徑（貼上/手動/券商/合併）都經過同一個 choke point（`snapshotSaveInFlight`） — ⚠️ 架構檢查

### F10 驗收條件 — ⚠️ 1/4 AC 有自動化測試

- **AC1**：新快照有、前一份沒有的代號 → 寫入正數 delta — ⚠️ delta 邏輯待抽出
- **AC2**：新快照股數與前一份不同 → delta = 新 − 舊 — ⚠️ delta 邏輯待抽出
- **AC3**：前一份有、新快照消失 → 寫入歸零列（delta = −舊值） — ⚠️ delta 邏輯待抽出
- **AC4**：同市場內所有數字欄以 float 寫入（不是字串數字） — ✅ `test_tonum.mjs`

### F11 驗收條件 — ⚠️ 1/3 AC 有自動化測試

- **AC1**：刪快照 → 對應 layout 列被清除，不留孤兒 — ⚠️ 需 API mock
- **AC2**：刪中段快照 → 僅「被刪日期 + 其後第一份」的 delta 重算，更後面不動 — ⚠️ 需 API mock
- **AC3**：整表寫回前，E/F/G 欄必須經 `toNum()` 數值化（防讀回字串原樣寫回的型別污染） — ✅ `test_tonum.mjs`

> 歷史教訓（session 24）：三個刪除函式全不碰 layout → 孤兒殘留＋重存重複計算。（session 34）：`syncLayoutAfterSnapshotChange` 的 read-modify-write 把字串型別原樣寫回，第二次觸發型別污染。

### F12 驗收條件 — ✅ 3/5 AC 有自動化測試

- **AC1**：雲端已有該代號的首次布局日 → 保留雲端值，不覆寫 — ✅ `test_firstbuy_merge.mjs`
- **AC2**：雲端沒有但本地有 → 新增該筆 — ✅ `test_firstbuy_merge.mjs`
- **AC3**：removals 清單內的代號 → 從雲端移除 — ✅ `test_firstbuy_merge.mjs`
- **AC4**：讀不到雲端現值（API 失敗）→ 整個寫入不執行 — ⚠️ 非純邏輯（async API 層）
- **AC5**：寫入失敗 → alert 通知使用者，不靜默失敗 — ⚠️ 純 UI

> 歷史教訓（session 40）：舊版整份覆寫，誤存市場後刪快照不回滾 → 6 支台股首次布局日永久丟失。

### F13 驗收條件 — ⚠️ 0/3 AC 有自動化測試

- **AC1**：台股早上（盤前）存快照 → 建議日期為前一交易日 — ⚠️ 邏輯待抽出到 logic.js
- **AC2**：美股凌晨（台北 00:00–08:00）存快照 → 建議日期為前一交易日 — ⚠️ 邏輯待抽出到 logic.js
- **AC3**：週一盤前 → 建議退到上週五 — ⚠️ 邏輯待抽出到 logic.js

> scratchpad 有 18 項測試設計（已流失）。歷史教訓（session 40）：台股漏「盤前退一天」，Sin 天天手動改日期 → 天天觸發 `userTouched` 關閉推薦功能。

### F16 驗收條件 — ✅ 2/3 AC 有自動化測試

- **AC1**：字串數字（如 `"123.45"`）→ `toNum` 轉成 `123.45`（number） — ✅ `test_tonum.mjs`
- **AC2**：空字串 / null / undefined → 回傳 `0` — ✅ `test_tonum.mjs`
- **AC3**：寫入 Sheet 時 `value_input_option="RAW"` + 數字欄為 number，確保 SUMIFS 正常 — ⚠️ API 層整合

> 歷史教訓（session 33/34）：文字型數字讓 SUMIFS 靜默歸零但 COUNTIFS/顯示都正常，極難察覺。「讀回→改一部分→整表 RAW 寫回」是活污染源。

### F17 驗收條件 — ✅ 2/2 AC 有自動化測試

- **AC1**：`taipeiNow()` 不論系統時區，回傳 UTC+8 的當前時間 — ✅ `test_datetime.mjs`
- **AC2**：`today()` 回傳格式 `YYYY-MM-DD`，基於 UTC+8 — ✅ `test_datetime.mjs`

> 歷史教訓（session 38）：`today()` 走 UTC，台北 00:00–08:00 全站 24 處「今天」少一天。改 UTC+8 後美股建議日期的「碰巧正確」消失，才發現是兩個錯誤互相抵銷。

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

### F18 驗收條件 — ⚠️ 0/3 AC 有自動化測試

- **AC1**：pending 判定完全不看本機 `phase`，只看雲端回填值 vs 最新快照的 diff — ⚠️ 邏輯待抽出到 logic.js
- **AC2**：`phase.done` 遇到 `isNew || sharesChanged` 必須降級為 idle（用 `sharesChanged` 不用 `changed`，避免均價容差雜訊叫回已回填的） — ⚠️ 邏輯待抽出到 logic.js
- **AC3**：僅均價微幅變動（容差 `max(0.01, 均價×0.0001)` 內）不算待回填，不進徽章 — ⚠️ 邏輯待抽出到 logic.js

> 歷史教訓（session 41）：`phase.done` 永不自動清 + early return 擺在算 diff 之前 → 任何裝置曾按過②完成就永久黏著「已回填」。（session 38）：券商碎股重算造成均價微幅漂移，無容差時觸發假回填。

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

### F32 驗收條件 — ⚠️ 0/1 AC 有自動化測試

- **AC1**：每份快照只更新自己市場的 delta 列，`market !== normalizeMarketKey(snapshot.market)` 時 skip（不產生跨市場假清倉） — ⚠️ 需完整 layout 上下文

> 歷史教訓（session 30）：`buildLayoutAnalysis` 把台/美股混在同一時間軸，單一市場更新時另一市場整批被誤判清倉。

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

### F43 驗收條件 — ⚠️ 0/3 AC 有自動化測試

- **AC1**：上市股（如 `2327`）用 `.TW` 後綴取得報價 — ⚠️ 需 API mock
- **AC2**：上櫃股（如 `5274`）`.TW` 查無價格時自動改試 `.TWO` — ⚠️ 需 API mock
- **AC3**：回傳 key 用原始代號（不帶 `.TW`/`.TWO` 後綴） — ⚠️ 需 API mock

> 歷史教訓（session 23）：持股清單加入第一支上櫃股 5274 才發現一律補 `.TW` 的假設不成立，現價永遠顯示「—」。

## Module F：月績效與現金試算（`homeSubTab: monthly`）

| F | 功能 | 關鍵函式 | 狀態 | 可測 | 後果 | 現有測試 |
|---|---|---|---|---|---|---|
| F44 | **月績效讀寫**（只寫 B/D/F＋補 C 欄公式，**E/G 絕不碰**） | `saveMonthlyPerf` | ✅ | 🟡 | 🔴 | ⚠️ |
| F45 | 多年 tab 支援＋未建年份一鍵建表 | `createPerfYearTab` | ✅ | 🟡 | 🟠 | ⚠️ |
| F46 | 跨 Sheet 讀 BudgetAssistant 月度帳本 | `BUDGET_SHEET_ID` | ✅ | 🟡 | ⚫ | ⚠️ |
| F47 | 現金需求試算（平均月支出→6 個月緩衝＋未來 12 個月計畫） | 月績效區塊內 | ✅ | 🟢 | ⚫ | ⚠️ |
| F48 | 現金計畫 tab 讀寫（全覆寫、保留 header） | `loadCashPlan` | ✅ | 🟡 | 🟠 | ⚠️ |

### F44 驗收條件 — ⚠️ 0/3 AC 有自動化測試

- **AC1**：引用的常數（`PERF_BASE_YEAR`、`PERF_HEADER`）必須有宣告，不得讓 ReferenceError 被 `.catch` 靜默吞掉 — ⚠️ 需程式碼靜態檢查
- **AC2**：只寫 B/D/F 欄 + 補 C 欄公式，E/G 欄絕不碰 — ⚠️ 需 API mock
- **AC3**：`.catch` 不得靜默吞掉程式錯誤（ReferenceError/TypeError 等），至少 console.error — ⚠️ 需程式碼靜態檢查

> 歷史教訓（session 20）：`PERF_BASE_YEAR`/`PERF_HEADER` 未宣告 → ReferenceError 被 `.catch(() => {})` 靜默吞掉 → 月績效表格完全空白、零 console error。

## Module G：基礎設施

| F | 功能 | 關鍵函式 | 狀態 | 可測 | 後果 | 現有測試 |
|---|---|---|---|---|---|---|
| F49 | Google OAuth 登入＋帳號白名單 | `signInAndLoadApp` / `DEFAULT_AUTHORIZED_EMAILS` | ✅ | 🟡 | 🔴 | ⚠️ |
| F50 | 重整免重登（token 效期內恢復 session） | `tryRestoreGoogleSession` | ✅ | 🟡 | ⚫ | ⚠️ |
| F51 | PWA／Service Worker 更新（no-store 繞 HTTP 快取） | `sw.js` | ✅ | ⚪ | 🟠 | ⚠️ |
| F52 | 備份匯出／匯入（IndexedDB 完整備份） | topbar「⋯ 更多」 | ✅ | 🟡 | 🟠 | ⚠️ |
| F53 | 本機開發貼 token 模式（僅 localhost 顯示） | `applyDevToken` | ✅ | 🟡 | ⚫ | ⚠️ |

---

## 測試現況總結（2026-08-15 Phase 0–4 完成後更新）

### 架構

純邏輯抽到 `logic.js`（ES module），app.js 透過 `logic-init.js` 橋接掛 `window`，測試直接 `import` from `logic.js`。改壞 logic.js → 測試立刻紅（已驗證）。

### repo 內測試

| 檔案 | 項數 | 覆蓋功能 | import 真程式碼 |
|---|---|---|---|
| `test_market_split.mjs` | 36 | F06（AC1–AC4）+ `normalizeMarketKey` | ✅ |
| `test_firstbuy_merge.mjs` | 27 | F12（AC1–AC3）+ `stripHeaderRow` | ✅ |
| `test_tonum.mjs` | 15 | F16（AC1–AC2）、F10-AC4、F11-AC3 | ✅ |
| `test_datetime.mjs` | 4 | F17（AC1–AC2） | ✅ |
| `test_parser.mjs` | 15 | F02（貼上解析） | ❌ 副本 |
| **合計** | **97** | | |

一行全跑：`node tests/run-all.mjs`

### AC 覆蓋率

| 狀態 | AC 數 | 功能 |
|---|---|---|
| ✅ 有自動化測試 | 14 | F06×4、F10-AC4、F11-AC3、F12×3、F16×2、F17×2 |
| ⚠️ 無自動化測試 | 28 | F08×3、F09×2、F10×3、F11×2、F12×2、F13×3、F16-AC3、F18×3、F32×1、F43×3、F44×3 |
| **合計（已定義 AC）** | **42** | **覆蓋率 33%** |

### 下一步優先

⚠️ AC 中最適合抽純邏輯補測試的：

1. **F13**（建議日期）— `suggestSnapshotTarget` 是純邏輯，scratchpad 曾有 18 項設計（已流失，需重寫）
2. **F18**（回填判定）— `arkRefillDiff` 是純邏輯，scratchpad 曾有 30 項設計（已流失，需重寫）
3. **F10**（布局 delta）— `saveLayoutDeltaToSheet` 的 diff 邏輯可抽出

### 優先度分級

- 🔴 高優先（反覆出問題或踩坑極深）：**F06** ✅／**F08** ⚠️／**F10** ⚠️／**F11** ⚠️／**F12** ✅／**F16** ✅／**F17** ✅／**F18** ⚠️／**F44** ⚠️
- 🟠 中優先（出過一次但教訓深刻）：**F09** ⚠️／**F43** ⚠️
- ⚫ 低優先（出過一次、已有保護）：**F13** ⚠️／**F32** ⚠️
