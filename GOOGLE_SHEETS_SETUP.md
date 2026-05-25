# AssetFlow Invest Google Sheets Sync

AssetFlow Invest v0.9.0 起可以把已確認的庫存快照寫入既有 Google Sheet `2026 Invest`。

## 需要準備

- Spreadsheet ID：`1adzBH3WaQ_pUgXeSKb2AeGkQE5pXejhHBxQ6MV8XtSI`
- Google OAuth Client ID：需由使用者自己的 Google Cloud 專案建立。

## 建立 OAuth Client ID

1. 到 Google Cloud Console 建立或選擇一個 project。
2. 啟用 Google Sheets API。
3. 建立 OAuth consent screen。
4. 建立 OAuth Client ID，類型選 `Web application`。
5. Authorized JavaScript origins 加入：
   - `https://li-sin.github.io`
   - 本機測試時可另外加入 `http://127.0.0.1:8765`
6. 複製產生的 Client ID。

## App 內設定

1. 打開 AssetFlow Invest。
2. 按 `同步設定`。
3. Sheet ID 可使用預設值。
4. 貼上 OAuth Client ID。
5. 第一次按 `存到 Google Sheet` 或 `讀取雲端庫存` 時，Google 會要求授權。

## 寫入的工作表

App 會在 `2026 Invest` 裡自動建立兩個 tab：

- `AssetFlowSnapshots`
- `AssetFlowPositions`

`AssetFlowSnapshots` 會存每次快照的 metadata；`AssetFlowPositions` 會存每支股票的庫存資料。

截圖原圖不會上傳到 Google Sheet；目前只同步確認後的庫存資料。
