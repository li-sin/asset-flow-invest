# AssetFlow Invest

AssetFlow Invest is a lightweight personal investing companion for collecting Ark app screenshots, notes, and update records.

## Local Use

Open `index.html` in a browser, or serve the folder with a static server.

## Google Access

v0.12.0 keeps Google sign-in before the app shell is shown, then automatically loads the latest cloud inventory into a dashboard-first home screen. Screenshot cards are now treated as the snapshot vault, while the dashboard separates Taiwan and US holdings, shows market-level Ark suggested water levels from the `水位` sheet tab, recent snapshot trends, daily layout totals, and position details. Adding screenshots opens a focused input panel instead of occupying the home screen. The app blocks duplicate same-day snapshots and can clean existing duplicate cloud snapshots while keeping the newest copy.

## Privacy

Screenshots are stored in the browser's local IndexedDB. This static site does not upload screenshots to a backend. Confirmed position snapshots can be written to the owner's Google Sheet after OAuth consent.
