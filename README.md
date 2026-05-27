# AssetFlow Invest

AssetFlow Invest is a lightweight personal investing companion for collecting Ark app screenshots, notes, and update records.

## Local Use

Open `index.html` in a browser, or serve the folder with a static server.

## Google Access

v0.13.5 keeps Google sign-in before the app shell is shown, then automatically loads the latest cloud inventory into a dashboard-first home screen. Numeric Google Sheets date serials are normalized back to `YYYY-MM-DD`. The dashboard uses bottom tabs for home, holdings, cloud snapshots, and capture entry. Cloud snapshot rows support swipe-to-delete while still confirming before removing snapshot and position rows from Google Sheets. Ark screenshot OCR now prefers one-row crops generated from the leading circle markers, so the row count used for completeness checks matches the rows sent to OCR more closely. The first snapshot per Taiwan/US market per day is unique, and the dashboard separates Taiwan and US holdings, market-level Ark suggested water levels, water-level/layout-cost analysis, per-stock daily share history, and position details.

## Privacy

Screenshots are stored in the browser's local IndexedDB. This static site does not upload screenshots to a backend. Confirmed position snapshots can be written to the owner's Google Sheet after OAuth consent.
