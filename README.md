# AssetFlow Invest

AssetFlow Invest is a lightweight personal investing companion for collecting Ark app screenshots, notes, and update records.

## Local Use

Open `index.html` in a browser, or serve the folder with a static server.

## Google Access

v0.13.11 keeps Google sign-in before the app shell is shown, then automatically loads the latest cloud inventory into a dashboard-first home screen. Numeric Google Sheets date serials are normalized back to `YYYY-MM-DD`. The dashboard uses bottom tabs for home, holdings, cloud snapshots, and capture entry. Cloud snapshot rows support swipe-to-delete while still confirming before removing snapshot and position rows from Google Sheets. Ark screenshot OCR checks leading circle markers against horizontal crop lines, prefers the visible `總共 N 檔` count for completeness, can infer missing symbols from known stock names, and shows crop-line calibration when the merged result is still short. Missing rows add blue candidate crop lines so the user can split uncut regions; multiple screenshots now share one global crop-line apply button so all adjusted images rerun together. The sign-in flow also suppresses service-worker reloads during/after OAuth to avoid the first login being interrupted. The first snapshot per Taiwan/US market per day is unique, and the dashboard separates Taiwan and US holdings, market-level Ark suggested water levels, water-level/layout-cost analysis, per-stock daily share history, and position details.

## Privacy

Screenshots are stored in the browser's local IndexedDB. This static site does not upload screenshots to a backend. Confirmed position snapshots can be written to the owner's Google Sheet after OAuth consent.
