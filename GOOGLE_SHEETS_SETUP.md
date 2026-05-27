# AssetFlow Invest Google Sheets Sync

AssetFlow Invest v0.13.5 起改為登入後自動載入雲端庫存儀表板，並仍須先使用 Google 帳號登入才會顯示主畫面。App 會將台股與美股庫存分開呈現，並限制每天每個市場只保留一筆快照；若同日同市場已有快照，寫入前會列出新增、移除、股數或均價差異，並詢問是否用最新一筆取代。Google Sheets 日期序號會先轉回 `YYYY-MM-DD`，避免顯示 `46166` 這類原始序號。首頁改成底部 tab，可在首頁、庫存、快照與新增入口間切換；快照 tab 可左滑雲端快照列並確認刪除。方舟截圖 OCR 優先用左側完整圓圈中心逐列裁切，再一列一列 OCR；只有偵測不到圓圈時才退回原本分隔線裁切。第一份快照視為初始庫存，後續快照會與前一份快照比較，計算每日布局股數增減與估算布局成本。方舟建議水位百分比會優先讀取 `水位` tab 的台股/美股市場層級水位。

## 需要準備

- Spreadsheet ID：`1adzBH3WaQ_pUgXeSKb2AeGkQE5pXejhHBxQ6MV8XtSI`
- Google OAuth Client ID：App 已內建預設值 320535010458-m89v1jjn7fkoeu5o9lj3mt5fsn6odp0v.apps.googleusercontent.com，需要更換時可在 App 內設定。
- 允許登入的 Google Email：固定為 lovelisa00000@gmail.com，不由前端輸入。

## 建立 OAuth Client ID

1. 到 Google Cloud Console 建立或選擇一個 project。
2. 啟用 Google Sheets API。
3. 建立 OAuth consent screen。
4. Publishing status 建議維持 `Testing`，Test users 只加入自己的 Google 帳號。
5. 建立 OAuth Client ID，類型選 `Web application`。
6. Authorized JavaScript origins 加入：
   - `https://li-sin.github.io`
   - 本機測試時可另外加入 `http://127.0.0.1:8765`
7. 複製產生的 Client ID。

## Google Sheet 權限

1. 打開 `2026 Invest`。
2. 取消「知道連結的人可檢視」的公開分享。
3. 只把 Sheet 分享給自己的 Google 帳號。

## App 內設定

1. 打開 AssetFlow Invest。
2. 按 `設定 OAuth`。
3. Sheet ID 可使用預設值。
4. OAuth Client ID 已有預設值，除非要更換 Google Cloud project，否則直接保留即可。
5. 允許登入帳號固定在程式內，不會在前端要求輸入。
6. 按 `使用 Google 登入`，並選擇固定允許帳號。

登入成功後，App 會使用 Google Sheets API 讀取與寫入：

- `AssetFlowSnapshots`
- `AssetFlowPositions`

截圖原圖不會上傳到 Google Sheet；目前只同步確認後的庫存資料。

## 限制

GitHub Pages 是靜態網站，無法在伺服器端阻止其他人下載頁面檔案。v0.9.3 的限制重點是：

- App UI 需要 Google 登入後才顯示。
- App 只接受固定帳號 lovelisa00000@gmail.com。
- Sheet 資料由 Google 帳號與 Sheet 分享權限保護。
