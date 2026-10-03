// Public-web fetch with connect-time address filtering and manual, re-validated redirects.
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import { checkUrlStatic, isPrivateIp } from "./policy.mjs";

/** dns.lookup replacement that refuses any private/internal answer (defeats DNS rebinding). */
export function makeSafeLookup(resolve = dns.lookup) {
  return (hostname, options, cb) => {
    if (typeof options === "function") { cb = options; options = {}; }
    resolve(hostname, { all: true, ...options }, (err, addrs) => {
      if (err) return cb(err);
      const list = Array.isArray(addrs) ? addrs : [{ address: addrs, family: 4 }];
      if (!list.length || list.some((a) => isPrivateIp(a.address))) return cb(Object.assign(new Error(`blocked address for ${hostname}`), { code: "PAOS_BLOCKED" }));
      if (options?.all) return cb(null, list);
      cb(null, list[0].address, list[0].family);
    });
  };
}

const TEXT_TYPES = /^(text\/|application\/(json|xml|xhtml\+xml)|application\/.*\+(json|xml))/i;

export async function fetchPublic(rawUrl, { maxBytes = 1_000_000, timeoutMs = 15_000, maxRedirects = 4, lookup = makeSafeLookup(), signal, headers = {} } = {}) {
  let url = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const chk = checkUrlStatic(url);
    if (!chk.ok) throw new Error(`URL blocked: ${chk.reason}`);
    const u = chk.url;
    const res = await new Promise((resolve, reject) => {
      const mod = u.protocol === "https:" ? https : http;
      const req = mod.request(u, { method: "GET", lookup, timeout: timeoutMs, signal, headers: { "user-agent": "paos-research/0.1", accept: "text/html,text/plain,application/json;q=0.9", ...headers } }, resolve);
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", reject); req.end();
    });
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.resume(); url = new URL(res.headers.location, u).toString(); continue;
    }
    const ctype = String(res.headers["content-type"] || "");
    if (!TEXT_TYPES.test(ctype)) { res.resume(); throw new Error(`unsupported content-type: ${ctype || "none"}`); }
    const chunks = []; let n = 0;
    for await (const c of res) { n += c.length; if (n > maxBytes) { res.destroy(); break; } chunks.push(c); }
    return { status: res.statusCode, finalUrl: u.toString(), contentType: ctype, truncated: n > maxBytes, body: Buffer.concat(chunks).toString("utf8").slice(0, maxBytes) };
  }
  throw new Error("too many redirects");
}

export function htmlToText(html) {
  return html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

/** DuckDuckGo HTML results (no key, no fee). Parsing is best-effort; fails closed to an empty list. */
export function parseDuckDuckGo(html, limit = 8) {
  const out = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/g;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    let href = m[1].replace(/&amp;/g, "&");
    const q = href.match(/[?&]uddg=([^&]+)/); if (q) href = decodeURIComponent(q[1]);
    if (href.startsWith("//")) href = "https:" + href;
    if (!checkUrlStatic(href).ok) continue;
    out.push({ title: htmlToText(m[2]), url: href, snippet: htmlToText(m[3] || "") });
  }
  return out;
}

/** Brave Search API result mapping. Returns [] on unexpected shape (caller treats empty as failure). */
export function parseBrave(json, limit = 8) {
  const rows = json?.web?.results; if (!Array.isArray(rows)) return [];
  return rows.slice(0, limit).map((r) => ({ title: htmlToText(String(r.title || "")), url: String(r.url || ""), snippet: htmlToText(String(r.description || "")) })).filter((r) => checkUrlStatic(r.url).ok);
}

/** Search via the configured backend. Never returns a silent empty list: failure is an error the model can see. */
export async function searchWeb(query, { provider = "none", apiKey = "", signal } = {}) {
  if (provider === "brave" && apiKey) {
    const r = await fetchPublic("https://api.search.brave.com/res/v1/web/search?count=8&q=" + encodeURIComponent(query), { signal, headers: { accept: "application/json", "x-subscription-token": apiKey } });
    if (r.status !== 200) throw new Error(`search backend returned HTTP ${r.status}`);
    const hits = parseBrave(JSON.parse(r.body)); if (!hits.length) throw new Error("search returned no results");
    return hits;
  }
  throw new Error("no search backend configured; use web_fetch with known public URLs instead");
}
