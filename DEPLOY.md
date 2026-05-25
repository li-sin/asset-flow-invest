# AssetFlow Invest Online Deploy

This app is a static PWA. It can be hosted on GitHub Pages or any static hosting.

## Privacy Model

- Screenshots are stored in the browser's local IndexedDB.
- The static host does not receive uploaded screenshots unless a future sync feature is added.
- Use `匯出備份` before changing devices or clearing browser data.

## GitHub Pages Target

Preferred repository:

```text
https://github.com/li-sin/asset-flow-invest
```

Expected URL after GitHub Pages is enabled:

```text
https://li-sin.github.io/asset-flow-invest/
```

## Deploy Steps

1. Create a public GitHub repository named `asset-flow-invest`.
2. Copy all files in this `app/` directory to the repository root.
3. Commit and push to `main`.
4. In GitHub repository settings, enable Pages from `main` / root.

## Local Preview

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8765/
```
