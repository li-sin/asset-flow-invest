# AssetFlow Invest

AssetFlow Invest is a lightweight personal investing companion for collecting Ark app screenshots, notes, and update records.

## Local Use

Open `index.html` in a browser, or serve the folder with a static server.

## Google Access

v0.10.1 keeps Google sign-in before the app shell is shown, includes the default Web OAuth Client ID, and fixes the allowed account to lovelisa00000@gmail.com. Screenshot details now open in a wide modal, and parsed position rows can be corrected for symbol, shares, and average cost before cloud merge. Cloud inventory reads and writes use the Google Sheets API with OAuth, so the `2026 Invest` sheet can stay private and shared only with the owner's Google account.

## Privacy

Screenshots are stored in the browser's local IndexedDB. This static site does not upload screenshots to a backend. Confirmed position snapshots can be written to the owner's Google Sheet after OAuth consent.
