# AssetFlow Invest Google Sheets Sync

AssetFlow Invest v0.9.9 起改為必須先使用 Google 帳號登入，才會顯示主畫面與讀取雲端庫存。`2026 Invest` 不需要開啟「知道連結的人可檢視」；建議只分享給自己的 Google 帳號。

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