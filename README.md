# Academic Homepage

Static academic homepage for GitHub Pages.

## Local Preview

```bash
python3 -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000/index.html
```

## Main Files

- `index.html`: page content and links
- `styles.css`: layout and visual style
- `script.js`: navigation highlighting
- `assets/`: images and public assets

## Link Click Statistics

- `link-stats.js`: tracks non-empty, non-anchor link clicks.
- `index.html`: displays homepage visit counts at the bottom of the page.
- `analytics-config.js`: public config for the statistics endpoint.
- `stats.html`: click-count dashboard. Open `http://127.0.0.1:8000/stats.html` locally.
- `tools/click-stats-apps-script.gs`: optional Google Sheets backend for site-wide counts.

Without a remote endpoint, counts are stored only in the current browser. To enable site-wide counts on GitHub Pages:

1. Create a Google Sheet.
2. Open Extensions -> Apps Script.
3. Paste `tools/click-stats-apps-script.gs` into the editor. If the script is not bound to the sheet, set `SPREADSHEET_ID`.
4. Deploy it as a Web App with "Execute as me" and access set to "Anyone".
5. Copy the `/exec` Web App URL into `analytics-config.js`:

```js
window.AcademicLinkStatsConfig = {
  siteId: "ccsunfy.github.io",
  endpoint: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
  storageKey: "academic-link-click-stats-v1",
};
```

After deployment, `index.html` sends link-click events and `stats.html` reads the aggregated summary.
