(function () {
  "use strict";

  const config = Object.assign(
    {
      siteId: window.location.hostname || "local",
      endpoint: "",
      totalViews: null,
      storageKey: "academic-link-click-stats-v1",
      debug: false,
    },
    window.AcademicLinkStatsConfig || {},
  );

  const recentLimit = 200;

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }

  function debug(message, detail) {
    if (!config.debug) return;
    console.info(`[link-stats] ${message}`, detail || "");
  }

  function hashString(value) {
    let hash = 0x811c9dc5;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }

    return (hash >>> 0).toString(36);
  }

  function isTrackableLink(link) {
    if (!link || link.hasAttribute("data-no-track")) return false;

    const rawHref = link.getAttribute("href");
    if (!rawHref) return false;

    const href = rawHref.trim();
    if (!href || href === "#" || href.startsWith("#")) return false;
    if (href.toLowerCase().startsWith("javascript:")) return false;

    return true;
  }

  function normalizeHref(link) {
    try {
      return new URL(link.getAttribute("href"), window.location.href).href;
    } catch (error) {
      return link.getAttribute("href") || "";
    }
  }

  function linkLabel(link) {
    return (
      link.getAttribute("data-stats-label") ||
      link.getAttribute("aria-label") ||
      link.textContent ||
      link.getAttribute("href") ||
      "Untitled link"
    )
      .replace(/\s+/g, " ")
      .trim();
  }

  function linkSection(link) {
    const container = link.closest("section[id], aside[aria-label], nav[aria-label], header, main");

    if (!container) return "page";
    if (container.id) return container.id;
    if (container.getAttribute("aria-label")) return container.getAttribute("aria-label");
    if (container.className) return String(container.className).split(/\s+/)[0];

    return container.tagName.toLowerCase();
  }

  function linkId(link) {
    const explicitId = link.getAttribute("data-stats-id") || link.id;

    if (explicitId) {
      return explicitId
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    }

    const basis = [normalizeHref(link), linkLabel(link), linkSection(link)].join("|");
    return `link-${hashString(basis)}`;
  }

  function sessionId() {
    const key = `${config.storageKey}-session`;

    try {
      const existing = window.sessionStorage.getItem(key);
      if (existing) return existing;

      const created = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(key, created);
      return created;
    } catch (error) {
      return "session-unavailable";
    }
  }

  function buildEvent(link) {
    const clickedAt = new Date().toISOString();

    return {
      type: "link_click",
      version: 1,
      siteId: config.siteId,
      linkId: linkId(link),
      label: linkLabel(link),
      href: normalizeHref(link),
      section: linkSection(link),
      page: window.location.pathname || "/",
      referrer: document.referrer || "",
      clickedAt,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      sessionId: sessionId(),
    };
  }

  function buildPageViewEvent() {
    const viewedAt = new Date().toISOString();

    return {
      type: "page_view",
      version: 1,
      siteId: config.siteId,
      page: window.location.pathname || "/",
      referrer: document.referrer || "",
      viewedAt,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      sessionId: sessionId(),
    };
  }

  function emptyStore() {
    return {
      version: 1,
      siteId: config.siteId,
      totalClicks: 0,
      updatedAt: "",
      homePageViews: {
        total: 0,
        firstViewedAt: "",
        lastViewedAt: "",
      },
      links: {},
      recent: [],
    };
  }

  function normalizeStore(store) {
    const normalized = Object.assign(emptyStore(), store || {});

    normalized.totalClicks = Number(normalized.totalClicks || 0);
    normalized.links = normalized.links || {};
    normalized.recent = Array.isArray(normalized.recent) ? normalized.recent : [];
    normalized.homePageViews = Object.assign(
      {
        total: 0,
        firstViewedAt: "",
        lastViewedAt: "",
      },
      normalized.homePageViews || {},
    );
    normalized.homePageViews.total = Number(normalized.homePageViews.total || 0);

    return normalized;
  }

  function loadStore() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(config.storageKey));
      if (parsed && parsed.version === 1 && parsed.links) return normalizeStore(parsed);
    } catch (error) {
      debug("Could not load local stats", error);
    }

    return emptyStore();
  }

  function saveStore(store) {
    try {
      window.localStorage.setItem(config.storageKey, JSON.stringify(store));
    } catch (error) {
      debug("Could not save local stats", error);
    }
  }

  function recordLocal(eventData) {
    const store = loadStore();
    const previous = store.links[eventData.linkId] || {
      linkId: eventData.linkId,
      label: eventData.label,
      href: eventData.href,
      section: eventData.section,
      total: 0,
      firstClickedAt: eventData.clickedAt,
      lastClickedAt: "",
    };

    previous.label = eventData.label;
    previous.href = eventData.href;
    previous.section = eventData.section;
    previous.total = Number(previous.total || 0) + 1;
    previous.lastClickedAt = eventData.clickedAt;

    store.siteId = config.siteId;
    store.totalClicks = Number(store.totalClicks || 0) + 1;
    store.updatedAt = eventData.clickedAt;
    store.links[eventData.linkId] = previous;
    store.recent = [eventData].concat(Array.isArray(store.recent) ? store.recent : []).slice(0, recentLimit);

    saveStore(store);
  }

  function recordLocalPageView(eventData) {
    const store = loadStore();
    const views = store.homePageViews;

    views.total = Number(views.total || 0) + 1;
    views.firstViewedAt = views.firstViewedAt || eventData.viewedAt;
    views.lastViewedAt = eventData.viewedAt;

    store.siteId = config.siteId;
    store.updatedAt = eventData.viewedAt;
    store.homePageViews = views;
    store.recent = [eventData].concat(Array.isArray(store.recent) ? store.recent : []).slice(0, recentLimit);

    saveStore(store);
    return store;
  }

  function sendRemote(eventData) {
    if (!config.endpoint) return;

    const body = JSON.stringify(eventData);

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
        if (navigator.sendBeacon(config.endpoint, blob)) return;
      }
    } catch (error) {
      debug("sendBeacon failed", error);
    }

    try {
      window
        .fetch(config.endpoint, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: {
            "Content-Type": "text/plain;charset=UTF-8",
          },
          body,
        })
        .catch((error) => debug("Remote event request failed", error));
    } catch (error) {
      debug("Remote event request could not start", error);
    }
  }

  function attachClickTracking() {
    document.addEventListener(
      "click",
      (event) => {
        const target =
          event.target && event.target.nodeType === Node.ELEMENT_NODE
            ? event.target
            : event.target && event.target.parentElement;
        const link = target ? target.closest("a[href]") : null;

        if (!isTrackableLink(link)) return;

        const eventData = buildEvent(link);
        recordLocal(eventData);
        sendRemote(eventData);
      },
      { capture: true },
    );
  }

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function rowsFromStore(store) {
    return Object.values(store.links || {}).sort((a, b) => {
      if (Number(b.total || 0) !== Number(a.total || 0)) {
        return Number(b.total || 0) - Number(a.total || 0);
      }

      return String(a.label || "").localeCompare(String(b.label || ""));
    });
  }

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function renderHomePageViews(total, source) {
    setText("homepage-visit-count", Number(total || 0).toLocaleString());
    setText("homepage-visit-source", source);
  }

  function pageViewsFromSummary(data) {
    if (!data) return 0;
    if (data.pageViews && typeof data.pageViews.total !== "undefined") {
      return Number(data.pageViews.total || 0);
    }

    return Number(data.totalPageViews || 0);
  }

  function totalViewsSettings() {
    return Object.assign(
      {
        hitUrl: "",
        getUrl: "",
        historicalOffset: 0,
        includeLocalHistory: false,
      },
      config.totalViews || {},
    );
  }

  function totalViewsMigrationKey(settings) {
    return `${config.storageKey}-total-views-migration-${settings.key || hashString(settings.hitUrl || "total")}`;
  }

  function localHistoryOffset(settings, localHistory) {
    const explicitOffset = Number(settings.historicalOffset || 0);

    if (!settings.includeLocalHistory) return explicitOffset;

    const previousLocalViews = Math.max(0, Number(localHistory || 0));
    const migrationKey = totalViewsMigrationKey(settings);

    try {
      const existing = JSON.parse(window.localStorage.getItem(migrationKey));
      if (existing && existing.version === 1) {
        return explicitOffset + Number(existing.localHistory || 0);
      }

      window.localStorage.setItem(
        migrationKey,
        JSON.stringify({
          version: 1,
          localHistory: previousLocalViews,
          createdAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      debug("Could not persist total views migration state", error);
    }

    return explicitOffset + previousLocalViews;
  }

  function counterValue(data) {
    if (!data) return NaN;

    const value = Number(data.value ?? data.count ?? data.total);
    return Number.isFinite(value) ? value : NaN;
  }

  function fetchCounterJson(url) {
    return window.fetch(url, { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error(`Counter request failed: ${response.status}`);
      return response.json();
    });
  }

  function initTotalViewsCounter(localHistory, localTotal) {
    const settings = totalViewsSettings();

    if (!settings.hitUrl) return false;

    const offset = localHistoryOffset(settings, localHistory);
    const explicitOffset = Number(settings.historicalOffset || 0);
    const fallbackTotal = localTotal + explicitOffset;

    renderHomePageViews(fallbackTotal, offset ? "Syncing total + history" : "Syncing total");

    fetchCounterJson(settings.hitUrl)
      .then((data) => {
        const remoteTotal = counterValue(data);
        if (!Number.isFinite(remoteTotal)) throw new Error("Counter response did not include a value.");

        renderHomePageViews(remoteTotal + offset, offset ? "Site-wide + history" : "Site-wide");
      })
      .catch((error) => {
        debug("Remote total views counter failed", error);

        if (!settings.getUrl) {
          renderHomePageViews(fallbackTotal, offset ? "This browser + history" : "This browser");
          return;
        }

        fetchCounterJson(settings.getUrl)
          .then((data) => {
            const remoteTotal = counterValue(data);
            if (!Number.isFinite(remoteTotal)) throw new Error("Counter response did not include a value.");

            renderHomePageViews(remoteTotal + offset, offset ? "Site-wide + history" : "Site-wide");
          })
          .catch(() => {
            renderHomePageViews(fallbackTotal, offset ? "This browser + history" : "This browser");
          });
      });

    return true;
  }

  function normalizeRows(rows) {
    if (!rows) return [];

    const sourceRows = Array.isArray(rows) ? rows : Object.values(rows);

    return sourceRows
      .map((row) => ({
        linkId: row.linkId || row.id || "",
        label: row.label || row.href || "Untitled link",
        href: row.href || "",
        section: row.section || "page",
        total: Number(row.total || row.count || 0),
        firstClickedAt: row.firstClickedAt || "",
        lastClickedAt: row.lastClickedAt || row.updatedAt || "",
      }))
      .sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
  }

  function renderRows(tbodyId, rows) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.textContent = "";

    if (!rows.length) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 4;
      emptyCell.className = "stats-empty";
      emptyCell.textContent = "No clicks recorded yet.";
      emptyRow.append(emptyCell);
      tbody.append(emptyRow);
      return;
    }

    rows.forEach((row) => {
      const tableRow = document.createElement("tr");
      const linkCell = document.createElement("td");
      const sectionCell = document.createElement("td");
      const totalCell = document.createElement("td");
      const lastCell = document.createElement("td");
      const link = document.createElement("a");
      const url = document.createElement("span");

      link.href = row.href || "#";
      link.textContent = row.label || row.href || row.linkId || "Untitled link";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("data-no-track", "");

      url.className = "stats-url";
      url.textContent = row.href || row.linkId || "";

      linkCell.append(link, url);
      sectionCell.textContent = row.section || "page";
      totalCell.className = "stats-number";
      totalCell.textContent = String(Number(row.total || 0));
      lastCell.textContent = formatDate(row.lastClickedAt);

      tableRow.append(linkCell, sectionCell, totalCell, lastCell);
      tbody.append(tableRow);
    });
  }

  function renderLocalStats() {
    const store = loadStore();
    const rows = rowsFromStore(store);

    setText("local-total-clicks", String(store.totalClicks || 0));
    setText("local-link-count", String(rows.length));
    setText("local-updated-at", formatDate(store.updatedAt));
    renderRows("local-stats-body", rows);
  }

  function renderRemoteStats(data) {
    if (!data || data.ok === false) {
      setText("remote-status", data && data.error ? data.error : "Remote statistics could not be loaded.");
      renderRows("remote-stats-body", []);
      return;
    }

    const rows = normalizeRows(data.links || data.rows || []);

    setText("remote-status", `Updated ${formatDate(data.generatedAt)}`);
    setText("remote-total-clicks", String(data.totalClicks || rows.reduce((sum, row) => sum + Number(row.total || 0), 0)));
    setText("remote-link-count", String(rows.length));
    renderRows("remote-stats-body", rows);
  }

  function requestRemoteSummary(onSuccess, onError) {
    if (!config.endpoint) {
      return false;
    }

    let url;
    const callbackName = `__academicLinkStats_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const script = document.createElement("script");
    let completed = false;

    try {
      url = new URL(config.statsEndpoint || config.endpoint, window.location.href);
    } catch (error) {
      if (onError) onError("Remote endpoint URL is invalid.");
      return false;
    }

    window[callbackName] = (data) => {
      completed = true;
      onSuccess(data);
      delete window[callbackName];
      script.remove();
    };

    url.searchParams.set("summary", "1");
    url.searchParams.set("callback", callbackName);

    script.async = true;
    script.src = url.toString();
    script.onerror = () => {
      if (completed) return;
      completed = true;
      delete window[callbackName];
      script.remove();
      if (onError) onError("Remote statistics request failed.");
    };

    document.head.append(script);

    window.setTimeout(() => {
      if (completed) return;
      completed = true;
      delete window[callbackName];
      script.remove();
      if (onError) onError("Remote statistics request timed out.");
    }, 10000);

    return true;
  }

  function loadRemoteStats() {
    if (!config.endpoint) {
      setText("remote-status", "Remote endpoint is not configured.");
      renderRows("remote-stats-body", []);
      return;
    }

    setText("remote-status", "Loading remote statistics...");

    requestRemoteSummary(renderRemoteStats, (message) => {
      setText("remote-status", message);
      renderRows("remote-stats-body", []);
    });
  }

  function loadRemoteHomePageViews(localTotal) {
    if (!config.endpoint) return;

    window.setTimeout(() => {
      requestRemoteSummary(
        (data) => {
          if (!data || data.ok === false) return;

          const remoteTotal = pageViewsFromSummary(data);
          if (remoteTotal > 0 || localTotal === 0) {
            renderHomePageViews(remoteTotal, "Site-wide");
          }
        },
        () => {
          renderHomePageViews(localTotal, "This browser");
        },
      );
    }, 1200);
  }

  function initHomePageStats() {
    if (!document.getElementById("homepage-visit-count")) return;

    const beforeStore = loadStore();
    const localHistory = beforeStore.homePageViews.total;
    const eventData = buildPageViewEvent();
    const store = recordLocalPageView(eventData);
    const localTotal = store.homePageViews.total;

    sendRemote(eventData);

    if (initTotalViewsCounter(localHistory, localTotal)) return;

    renderHomePageViews(localTotal, config.endpoint ? "This browser, syncing" : "This browser");
    loadRemoteHomePageViews(localTotal);
  }

  function exportLocalStats() {
    const store = loadStore();
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(store, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `link-click-stats-${date}.json`;
    link.setAttribute("data-no-track", "");
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetLocalStats() {
    if (!window.confirm("Clear click statistics stored in this browser?")) return;
    saveStore(emptyStore());
    renderLocalStats();
  }

  function initStatsPage() {
    renderLocalStats();
    loadRemoteStats();

    const exportButton = document.getElementById("export-local-stats");
    const resetButton = document.getElementById("reset-local-stats");

    if (exportButton) exportButton.addEventListener("click", exportLocalStats);
    if (resetButton) resetButton.addEventListener("click", resetLocalStats);
  }

  ready(() => {
    if (document.body && document.body.dataset.page === "stats") {
      initStatsPage();
      return;
    }

    attachClickTracking();
    initHomePageStats();
  });
})();
