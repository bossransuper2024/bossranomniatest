(function () {
  const originalFetch = window.fetch.bind(window);
  const originalXhrOpen = window.XMLHttpRequest && window.XMLHttpRequest.prototype.open;
  const originalXhrSend = window.XMLHttpRequest && window.XMLHttpRequest.prototype.send;
  const originalXhrSetRequestHeader = window.XMLHttpRequest && window.XMLHttpRequest.prototype.setRequestHeader;

  const SERVICES_RE = /\/(?:api\/)?community\/services(?:[/?]|$)/i;
  const STREAMERS_RE = /\/(?:api\/)?community\/streamers?(?:[/?]|$)/i;
  const MIDDLEMEN_RE = /\/(?:api\/)?community\/(?:middlemen|middleman|middle-men)(?:[/?]|$)/i;
  const PILOTS_RE = /\/(?:api\/)?community\/pilots?(?:[/?]|$)/i;
  const MY_RATINGS_RE = /\/(?:api\/)?community\/my-ratings(?:[/?]|$)/i;
  const RATE_RE = /\/(?:api\/)?community\/rate(?:[/?]|$)/i;
  const BRIDGE_BASE_URL = (() => {
    if (document.currentScript && document.currentScript.src) {
      return new URL(".", document.currentScript.src);
    }
    return new URL("./", window.location.href);
  })();
  const HOME_PATH = (() => {
    const path = BRIDGE_BASE_URL.pathname || "/";
    return path.endsWith("/") ? path : `${path}/`;
  })();

  function jsonResponse(payload) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  function resolveLocalUrl(relativePath) {
    return new URL(relativePath.replace(/^\//, ""), BRIDGE_BASE_URL).toString();
  }

  function isServicesRequest(url) {
    return SERVICES_RE.test(url);
  }

  function isMyRatingsRequest(url) {
    return MY_RATINGS_RE.test(url);
  }

  function isRateRequest(url) {
    return RATE_RE.test(url);
  }

  function getCommunityListKind(url) {
    const raw = String(url || "");
    const lower = raw.toLowerCase();

    if (STREAMERS_RE.test(raw) || /streamer/.test(lower)) return "streamers";
    if (MIDDLEMEN_RE.test(raw) || /middle[-\s]?man/.test(lower) || /middlemen/.test(lower)) return "middlemen";
    if (PILOTS_RE.test(raw) || /pilot/.test(lower)) return "pilots";
    return "";
  }

  function isAnyCommunityRequest(url) {
    return /\/community\//i.test(String(url || ""));
  }

  function getUrlString(input) {
    return typeof input === "string" ? input : (input && input.url) || "";
  }

  function setMockProperty(target, key, value) {
    try {
      Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value
      });
      return;
    } catch {}

    try {
      target[key] = value;
    } catch {}
  }

  function emitXhrEvent(xhr, name) {
    const handlerName = `on${name}`;
    if (typeof xhr[handlerName] === "function") {
      try {
        xhr[handlerName]();
      } catch {}
    }
    try {
      xhr.dispatchEvent(new Event(name));
    } catch {}
  }

  function completeMockXhr(xhr, payload, statusCode) {
    const responseText = JSON.stringify(payload);
    const status = Number(statusCode) || 200;

    setMockProperty(xhr, "readyState", 4);
    setMockProperty(xhr, "status", status);
    setMockProperty(xhr, "statusText", status >= 200 && status < 300 ? "OK" : "Error");
    setMockProperty(xhr, "responseText", responseText);

    if (!xhr.responseType || xhr.responseType === "text" || xhr.responseType === "") {
      setMockProperty(xhr, "response", responseText);
    } else if (xhr.responseType === "json") {
      setMockProperty(xhr, "response", payload);
    } else {
      setMockProperty(xhr, "response", responseText);
    }

    xhr.getAllResponseHeaders = function getAllResponseHeaders() {
      return "content-type: application/json\r\n";
    };
    xhr.getResponseHeader = function getResponseHeader(name) {
      if (!name) return null;
      return String(name).toLowerCase() === "content-type" ? "application/json" : null;
    };

    emitXhrEvent(xhr, "readystatechange");
    if (status >= 200 && status < 300) {
      emitXhrEvent(xhr, "load");
    } else {
      emitXhrEvent(xhr, "error");
    }
    emitXhrEvent(xhr, "loadend");
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function hideUnwiredRatingBlocks(root) {
    if (!root || !root.querySelectorAll) return;

    const candidates = root.querySelectorAll("div, span, p, small, li");
    for (const node of candidates) {
      if (node.__ratingUiChecked) continue;
      node.__ratingUiChecked = true;

      const text = normalizeText(node.textContent);
      if (!text.includes("login to rate")) continue;
      if (text.length > 80) continue;
      if (node.children && node.children.length > 8) continue;
      if (node.querySelector && node.querySelector("a, button, input, select, textarea, [role='button']")) continue;

      if (node.style) node.style.display = "none";
    }
  }

  function hideGuildHolderPanel(root) {
    if (!root || !root.querySelectorAll) return;

    const candidates = root.querySelectorAll("div, section, article");
    for (const node of candidates) {
      if (node.__guildUiChecked) continue;
      node.__guildUiChecked = true;

      const text = normalizeText(node.textContent);
      if (!text.includes("guild holding the region")) continue;
      if (text.includes("enter school")) continue;
      if (text.length > 600) continue;

      let panel = node;
      let current = node;
      for (let i = 0; i < 4; i += 1) {
        const parent = current.parentElement;
        if (!parent) break;
        const parentText = normalizeText(parent.textContent);
        if (!parentText.includes("guild holding the region")) break;
        if (parentText.includes("enter school")) break;
        if (parentText.length > 700) break;
        panel = parent;
        current = parent;
      }

      if (panel && panel.style) {
        panel.style.display = "none";
      }
    }
  }

  function applyBossranBranding(root) {
    if (!root || !document) return;

    // Keep page-level branding consistent.
    if (document.title !== "BOSSRAN OMNIA") {
      document.title = "BOSSRAN OMNIA";
    }

    const metaUpdates = [
      ["meta[property='og:title']", "BOSSRAN OMNIA"],
      ["meta[property='og:site_name']", "BOSSRAN OMNIA"],
      ["meta[name='twitter:title']", "BOSSRAN OMNIA"],
      ["meta[property='og:description']", "Bossran Omnia - BabyRan/BossRan gameplay, balanced classes, no 1 hit, 30 max rebirth, and fair donator vs non-donator balance."],
      ["meta[name='twitter:description']", "Bossran Omnia - BabyRan/BossRan gameplay, balanced classes, no 1 hit, 30 max rebirth, and fair donator vs non-donator balance."],
      ["meta[name='description']", "Bossran Omnia - BabyRan/BossRan gameplay, balanced classes, no 1 hit, 30 max rebirth, and fair donator vs non-donator balance."]
    ];
    for (const [selector, value] of metaUpdates) {
      const el = document.querySelector(selector);
      if (el && el.getAttribute("content") !== value) {
        el.setAttribute("content", value);
      }
    }

    const replacements = [
      [/\bYG\s*RAN\s*ONLINE\b/gi, "BOSSRAN OMNIA"],
      [/\bRAN\s*ONLINE\b/gi, "BOSSRAN OMNIA"],
      [/\bYG\s*RAN\b/gi, "BOSSRAN OMNIA"],
      [/EPISODE\\s*7\\s*[^A-Z0-9]*\\s*PURE\\s*HUNT\\s*SERVER/gi, "BABYRAN / BOSSRAN GAMEPLAY"],
      [/NO\\s*PAID\\s*GL\\s*[^A-Z0-9]*\\s*CRAFT\\s*BASED\\s*[^A-Z0-9]*\\s*FAIR\\s*PLAY/gi, "DONATOR VS NON-DONATOR BALANCED - NO 1 HIT - NO AUTO SKILL"]
    ];

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parentTag = node.parentElement && node.parentElement.tagName;
      if (parentTag !== "SCRIPT" && parentTag !== "STYLE" && parentTag !== "NOSCRIPT") {
        const original = node.nodeValue;
        if (original && original.trim()) {
          let updated = original;
          for (const [pattern, replacement] of replacements) {
            updated = updated.replace(pattern, replacement);
          }
          if (updated !== original) {
            node.nodeValue = updated;
          }
        }
      }
      node = walker.nextNode();
    }
  }

  function goToHomePath() {
    try {
      const url = new URL(window.location.href);
      let changed = false;

      if (url.pathname !== HOME_PATH) {
        url.pathname = HOME_PATH;
        changed = true;
      }
      if (url.hash && !/^#\/?$/.test(url.hash)) {
        url.hash = "";
        changed = true;
      }

      if (changed) {
        window.history.replaceState({}, "", url.toString());
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    } catch {}
  }

  function recoverFromNotFoundModal(root) {
    if (!root || !root.querySelectorAll) return;

    const nodes = root.querySelectorAll("div, section, article, p, h1, h2, h3");
    for (const node of nodes) {
      if (node.__notFoundUiChecked) continue;
      node.__notFoundUiChecked = true;

      const text = normalizeText(node.textContent);
      if (!text.includes("page not found")) continue;

      const container = node.closest("div, section, article") || node;
      const buttons = (container.querySelectorAll && container.querySelectorAll("button, a")) || [];
      let homeButton = null;
      for (const btn of buttons) {
        const label = normalizeText(btn.textContent);
        if (label.includes("return to homepage") || label.includes("homepage")) {
          homeButton = btn;
          break;
        }
      }

      if (homeButton && typeof homeButton.click === "function") {
        try {
          homeButton.click();
        } catch {}
      }

      setTimeout(goToHomePath, 50);
      break;
    }
  }

  function enforceLobbyTaglines(root) {
    if (!root || !document) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const parentTag = node.parentElement && node.parentElement.tagName;
      if (parentTag !== "SCRIPT" && parentTag !== "STYLE" && parentTag !== "NOSCRIPT") {
        const original = node.nodeValue;
        if (original && original.trim()) {
          let updated = original;

          updated = updated.replace(/\bEPISODE\s*7\b/gi, "BABYRAN / BOSSRAN GAMEPLAY");
          updated = updated.replace(/\bPURE\s*HUNT\s*SERVER\b/gi, "");
          updated = updated.replace(/\bNO\s*PAID\s*GL\b/gi, "DONATOR VS NON-DONATOR BALANCED");
          updated = updated.replace(/\bCRAFT\s*BASED\b/gi, "NO 1 HIT");
          updated = updated.replace(/\bFAIR\s*PLAY\b/gi, "NO AUTO SKILL");
          updated = updated.replace(/\s*[•\-]\s*$/g, "");
          updated = updated.replace(/\s{2,}/g, " ").trim();

          if (updated !== original) {
            node.nodeValue = updated;
          }
        }
      }
      node = walker.nextNode();
    }
  }

  function startUiCleanup() {
    const run = () => {
      hideUnwiredRatingBlocks(document);
      hideGuildHolderPanel(document);
      applyBossranBranding(document.body || document);
      recoverFromNotFoundModal(document);
      enforceLobbyTaglines(document);

      const panel = document.getElementById("bossran-server-panel");
      if (panel && panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    };
    run();

    const observer = new MutationObserver(() => {
      run();
    });
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
  }

  function splitCsvLine(line, delimiter) {
    const out = [];
    let curr = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === "\"") {
        if (inQuotes && line[i + 1] === "\"") {
          curr += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(curr.trim());
        curr = "";
      } else {
        curr += ch;
      }
    }
    out.push(curr.trim());
    return out;
  }

  function normalizeKey(key) {
    return String(key || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[_-]+/g, "");
  }

  const DEFAULT_COLUMNS = ["example", "name", "streamercode", "join", "link"];
  const KNOWN_HEADER_KEYS = new Set([
    "example",
    "platform",
    "type",
    "name",
    "streamercode",
    "code",
    "referralcode",
    "ign",
    "join",
    "since",
    "date",
    "link",
    "url",
    "pageurl",
    "page",
    "socialmedia",
    "description",
    "desc",
    "fee",
    "hourlyrate",
    "hourly",
    "avgrating",
    "ratingcount",
    "availability",
    "status"
  ]);

  function looksLikeHeaderRow(normalizedCells) {
    let matches = 0;
    for (const cell of normalizedCells) {
      if (KNOWN_HEADER_KEYS.has(cell)) matches += 1;
    }
    return matches >= 2;
  }

  function normalizeDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    let m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return raw;

    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
    return "";
  }

  function parseNumber(value, fallback) {
    const n = Number(String(value || "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : fallback;
  }

  function pick(row, keys, fallback) {
    for (const key of keys) {
      if (row[key] !== undefined && String(row[key]).trim() !== "") {
        return String(row[key]).trim();
      }
    }
    return fallback;
  }

  async function readCsv(path) {
    const response = await originalFetch(path, { cache: "no-store" });
    if (!response.ok) return [];
    const text = await response.text();

    const lines = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    if (lines.length === 0) return [];
    const delimiter = lines[0].includes("\t") ? "\t" : ",";
    const firstRow = splitCsvLine(lines[0], delimiter);
    const firstRowNormalized = firstRow.map(normalizeKey);
    const hasHeader = looksLikeHeaderRow(firstRowNormalized);

    const headers = hasHeader
      ? firstRowNormalized
      : firstRowNormalized.map((_, idx) => DEFAULT_COLUMNS[idx] || `col${idx + 1}`);
    const dataStartIndex = hasHeader ? 1 : 0;

    const rows = [];
    for (let i = dataStartIndex; i < lines.length; i += 1) {
      const values = splitCsvLine(lines[i], delimiter);
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] !== undefined ? values[idx] : "";
      });
      rows.push(row);
    }
    return rows;
  }

  async function buildCommunityServicesPayload() {
    const streamerRows = await readCsv(resolveLocalUrl("data/streamer.csv"));
    const middlemanRows = await readCsv(resolveLocalUrl("data/midman.csv"));
    const pilotRows = await readCsv(resolveLocalUrl("data/pilot.csv"));

    const streamers = streamerRows.map((row, i) => {
      const platform = pick(row, ["example", "platform", "type"], "facebook");
      const name = pick(row, ["name"], `Streamer ${i + 1}`);
      const code = pick(row, ["streamercode", "code", "referralcode", "ign"], "");
      const since = normalizeDate(pick(row, ["join", "since", "date"], ""));
      const link = pick(row, ["link", "url", "pageurl", "page"], "");

      return {
        id: i + 1,
        name,
        platform,
        referralCode: code || "N/A",
        since: since || null,
        pageUrl: link || "#",
        profilePic: null
      };
    });

    const middlemen = middlemanRows.map((row, i) => {
      const name = pick(row, ["name"], `Middleman ${i + 1}`);
      const code = pick(row, ["streamercode", "code", "ign"], "");
      const since = normalizeDate(pick(row, ["join", "since", "date"], ""));
      const link = pick(row, ["link", "url", "socialmedia", "page"], "");

      return {
        id: 1000 + i + 1,
        name,
        ign: code || "N/A",
        description: pick(row, ["description", "desc"], "Trusted middleman service."),
        fee: parseNumber(pick(row, ["fee"], "0"), 0),
        since: since || null,
        avgRating: parseNumber(pick(row, ["avgrating"], "0"), 0),
        ratingCount: parseNumber(pick(row, ["ratingcount"], "0"), 0),
        socialMedia: link || "#",
        userId: null,
        profilePic: null
      };
    });

    const pilots = pilotRows.map((row, i) => {
      const name = pick(row, ["name"], `Pilot ${i + 1}`);
      const since = normalizeDate(pick(row, ["join", "since", "date"], ""));
      const link = pick(row, ["link", "url", "socialmedia", "page"], "");
      const availabilityRaw = pick(row, ["availability", "status"], "available").toLowerCase();

      return {
        id: 2000 + i + 1,
        name,
        description: pick(row, ["description", "desc"], "Leveling and character management service."),
        fee: parseNumber(pick(row, ["fee"], "0"), 0),
        hourlyRate: parseNumber(pick(row, ["hourlyrate", "hourly"], "0"), 0),
        since: since || null,
        avgRating: parseNumber(pick(row, ["avgrating"], "0"), 0),
        ratingCount: parseNumber(pick(row, ["ratingcount"], "0"), 0),
        socialMedia: link || "#",
        availabilityStatus: availabilityRaw.includes("hired") || availabilityRaw.includes("occupied") ? "hired" : "available",
        userId: null,
        profilePic: null
      };
    });

    return {
      success: true,
      streamers,
      middlemen,
      pilots,
      streamerServices: streamers,
      middlemanServices: middlemen,
      middleManServices: middlemen,
      middleMans: middlemen,
      middlemans: middlemen,
      pilotServices: pilots,
      data: {
        streamers,
        middlemen,
        pilots
      }
    };
  }

  async function buildCommunityListPayload(kind) {
    const all = await buildCommunityServicesPayload();
    const list = all[kind] || [];
    const payload = {
      success: true,
      data: list,
      items: list,
      [kind]: list
    };

    if (kind === "streamers") {
      payload.streamerServices = list;
    } else if (kind === "middlemen") {
      payload.middlemanServices = list;
      payload.middleManServices = list;
      payload.middleMans = list;
      payload.middlemans = list;
    } else if (kind === "pilots") {
      payload.pilotServices = list;
    }

    return payload;
  }

  window.fetch = async function patchedFetch(input, init) {
    const url = getUrlString(input);

    if (isServicesRequest(url)) {
      try {
        const payload = await buildCommunityServicesPayload();
        return jsonResponse(payload);
      } catch {
        return jsonResponse({ success: false, streamers: [], middlemen: [], pilots: [] });
      }
    }

    const listKind = getCommunityListKind(url);
    if (listKind) {
      try {
        return jsonResponse(await buildCommunityListPayload(listKind));
      } catch {
        return jsonResponse({ success: true, data: [], items: [], [listKind]: [] });
      }
    }

    if (isMyRatingsRequest(url)) {
      return jsonResponse({ success: true, ratings: [] });
    }

    if (isRateRequest(url)) {
      return jsonResponse({ success: true });
    }

    if (isAnyCommunityRequest(url)) {
      return jsonResponse({ success: true, data: [], items: [] });
    }

    return originalFetch(input, init);
  };

  // Axios/browser adapters often use XMLHttpRequest, so we intercept that too.
  if (window.XMLHttpRequest && originalXhrOpen && originalXhrSend && originalXhrSetRequestHeader) {
    window.XMLHttpRequest.prototype.open = function patchedOpen(method, url, async, user, password) {
      this.__communityInterceptUrl = String(url || "");
      this.__communityShouldIntercept =
        isServicesRequest(this.__communityInterceptUrl) ||
        isMyRatingsRequest(this.__communityInterceptUrl) ||
        isRateRequest(this.__communityInterceptUrl) ||
        isAnyCommunityRequest(this.__communityInterceptUrl);

      if (this.__communityShouldIntercept) {
        this.__communityOriginalMethod = method;
        this.__communityOriginalAsync = async;
        this.__communityOriginalUser = user;
        this.__communityOriginalPassword = password;
        setMockProperty(this, "readyState", 1);
        emitXhrEvent(this, "readystatechange");
        return;
      }

      return originalXhrOpen.call(this, method, url, async, user, password);
    };

    window.XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(name, value) {
      if (this.__communityShouldIntercept) return;
      return originalXhrSetRequestHeader.call(this, name, value);
    };

    window.XMLHttpRequest.prototype.send = function patchedSend(body) {
      if (!this.__communityShouldIntercept) {
        return originalXhrSend.call(this, body);
      }

      const xhr = this;
      const targetUrl = xhr.__communityInterceptUrl || "";

      (async function respondWithMock() {
        let payload;
        if (isServicesRequest(targetUrl)) {
          payload = await buildCommunityServicesPayload();
        } else {
          const listKind = getCommunityListKind(targetUrl);
          if (listKind) {
            payload = await buildCommunityListPayload(listKind);
          } else if (isMyRatingsRequest(targetUrl)) {
            payload = { success: true, ratings: [] };
          } else if (isRateRequest(targetUrl)) {
            payload = { success: true };
          } else {
            payload = { success: true, data: [], items: [] };
          }
        }
        completeMockXhr(xhr, payload, 200);
      })().catch(function onMockError() {
        completeMockXhr(xhr, { success: false, streamers: [], middlemen: [], pilots: [] }, 200);
      });
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startUiCleanup, { once: true });
  } else {
    startUiCleanup();
  }
})();

