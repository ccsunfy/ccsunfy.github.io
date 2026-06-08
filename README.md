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

- `link-stats.js`: tracks non-empty, non-anchor link clicks and homepage visits.
- `index.html`: displays total homepage visits at the bottom of the page.
- `analytics-config.js`: public config for link statistics and total visit counting.
- `stats.html`: click-count dashboard. Open `http://127.0.0.1:8000/stats.html` locally.
- `tools/click-stats-apps-script.gs`: optional Google Sheets backend for site-wide counts.

Homepage total visits use the public `totalViews.hitUrl` counter in `analytics-config.js`. To add known historical traffic, set `totalViews.historicalOffset` to that number. When `includeLocalHistory` is true, each browser also preserves its existing local homepage-view count as a one-time history offset after the upgrade.

Without a Google Apps Script endpoint, link-click counts are stored only in the current browser. To enable site-wide link-click counts on GitHub Pages:

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
