# AssetFlow Invest

AssetFlow Invest is a lightweight personal investing companion for collecting Ark app screenshots, notes, and update records.

## Local Use

Open `index.html` in a browser, or serve the folder with a static server.

## Google Access

v0.13.2 keeps Google sign-in before the app shell is shown, then automatically loads the latest cloud inventory into a dashboard-first home screen. The first snapshot per Taiwan/US market per day is unique: if a same-day market snapshot already exists, the app lists stock-level differences and asks whether to replace the old snapshot with the latest one. The dashboard separates Taiwan and US holdings, shows market-level Ark suggested water levels from the `水位` sheet tab, a daily water-level/layout-cost chart, per-stock daily share history, and position details. The UI adapts for desktop, iPad, and phone widths, and screenshot OCR checks the count of full leading circle markers against parsed rows.

## Privacy

Screenshots are stored in the browser's local IndexedDB. This static site does not upload screenshots to a backend. Confirmed position snapshots can be written to the owner's Google Sheet after OAuth consent.
