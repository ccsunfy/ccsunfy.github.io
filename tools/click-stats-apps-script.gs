const SPREADSHEET_ID = "";
const CLICK_SHEET_NAME = "clicks";

const HEADER = [
  "receivedAt",
  "siteId",
  "linkId",
  "label",
  "href",
  "section",
  "page",
  "referrer",
  "sessionId",
  "timezone",
  "clickedAt",
  "eventType",
];

function doPost(event) {
  try {
    const payload = parsePayload_(event);

    if (!payload || (payload.type !== "link_click" && payload.type !== "page_view")) {
      return jsonOutput_({ ok: false, error: "Unsupported payload." });
    }

    const sheet = clickSheet_();

    sheet.appendRow([
      new Date(),
      safeCell_(payload.siteId),
      safeCell_(payload.linkId),
      safeCell_(payload.label),
      safeCell_(payload.href),
      safeCell_(payload.section),
      safeCell_(payload.page),
      safeCell_(payload.referrer),
      safeCell_(payload.sessionId),
      safeCell_(payload.timezone),
      safeCell_(payload.clickedAt || payload.viewedAt),
      safeCell_(payload.type),
    ]);

    return jsonOutput_({ ok: true });
  } catch (error) {
    return jsonOutput_({ ok: false, error: String(error) });
  }
}

function doGet(event) {
  const params = (event && event.parameter) || {};

  if (params.summary === "1") {
    return jsonOutput_(summary_(), params.callback);
  }

  return jsonOutput_({ ok: true, message: "Academic link click statistics endpoint." }, params.callback);
}

function parsePayload_(event) {
  if (!event || !event.postData || !event.postData.contents) return null;
  return JSON.parse(event.postData.contents);
}

function spreadsheet_() {
  if (SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error("Set SPREADSHEET_ID or bind this script to a Google Sheet.");

  return active;
}

function clickSheet_() {
  const spreadsheet = spreadsheet_();
  let sheet = spreadsheet.getSheetByName(CLICK_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CLICK_SHEET_NAME);
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
  }

  ensureHeader_(sheet);
  return sheet;
}

function ensureHeader_(sheet) {
  const existing = sheet.getRange(1, 1, 1, HEADER.length).getValues()[0];
  const matches = HEADER.every((name, index) => existing[index] === name);

  if (!matches) {
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
    sheet.setFrozenRows(1);
  }
}

function summary_() {
  const values = clickSheet_().getDataRange().getValues();
  const header = values.shift() || [];
  const columns = {};
  const links = {};
  const pageViews = {
    total: 0,
    firstViewedAt: "",
    lastViewedAt: "",
  };
  let totalClicks = 0;

  header.forEach((name, index) => {
    columns[name] = index;
  });

  values.forEach((row) => {
    const linkId = String(row[columns.linkId] || "");
    const eventType = String(row[columns.eventType] || (linkId ? "link_click" : ""));
    const eventAt = isoDate_(row[columns.clickedAt]) || isoDate_(row[columns.receivedAt]);

    if (eventType === "page_view") {
      pageViews.total += 1;

      if (eventAt && (!pageViews.firstViewedAt || eventAt < pageViews.firstViewedAt)) {
        pageViews.firstViewedAt = eventAt;
      }

      if (eventAt && (!pageViews.lastViewedAt || eventAt > pageViews.lastViewedAt)) {
        pageViews.lastViewedAt = eventAt;
      }

      return;
    }

    if (eventType !== "link_click" || !linkId) return;

    if (!links[linkId]) {
      links[linkId] = {
        linkId,
        label: String(row[columns.label] || ""),
        href: String(row[columns.href] || ""),
        section: String(row[columns.section] || ""),
        total: 0,
        firstClickedAt: eventAt,
        lastClickedAt: eventAt,
      };
    }

    links[linkId].label = String(row[columns.label] || links[linkId].label);
    links[linkId].href = String(row[columns.href] || links[linkId].href);
    links[linkId].section = String(row[columns.section] || links[linkId].section);
    links[linkId].total += 1;

    if (eventAt && (!links[linkId].lastClickedAt || eventAt > links[linkId].lastClickedAt)) {
      links[linkId].lastClickedAt = eventAt;
    }

    if (eventAt && (!links[linkId].firstClickedAt || eventAt < links[linkId].firstClickedAt)) {
      links[linkId].firstClickedAt = eventAt;
    }

    totalClicks += 1;
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    totalClicks,
    totalPageViews: pageViews.total,
    pageViews,
    links: Object.values(links).sort((a, b) => b.total - a.total),
  };
}

function jsonOutput_(data, callback) {
  const callbackName = safeCallback_(callback);
  const text = callbackName ? `${callbackName}(${JSON.stringify(data)});` : JSON.stringify(data);
  const output = ContentService.createTextOutput(text);

  output.setMimeType(callbackName ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  return output;
}

function safeCallback_(callback) {
  if (!callback) return "";

  const name = String(callback);
  return /^[A-Za-z_$][0-9A-Za-z_$.]*$/.test(name) ? name : "";
}

function safeCell_(value) {
  const text = String(value || "").slice(0, 1000);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function isoDate_(value) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString();
}
