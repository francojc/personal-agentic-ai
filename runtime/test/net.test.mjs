import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { makeSafeLookup, fetchPublic, htmlToText, parseDuckDuckGo } from "../net.mjs";

test("safe lookup rejects private answers for public-looking names", async () => {
  const lookup = makeSafeLookup((h, o, cb) => cb(null, [{ address: "10.0.4.1", family: 4 }]));
  await assert.rejects(new Promise((res, rej) => lookup("evil.example.com", {}, (e, a) => (e ? rej(e) : res(a)))), /blocked address/);
  const ok = makeSafeLookup((h, o, cb) => cb(null, [{ address: "93.184.216.34", family: 4 }]));
  assert.equal(await new Promise((res, rej) => ok("x.example.com", {}, (e, a) => (e ? rej(e) : res(a)))), "93.184.216.34");
});

test("fetchPublic refuses loopback server and file URLs", async () => {
  const srv = http.createServer((_, r) => r.end("secret")).listen(0, "127.0.0.1"); await new Promise((r) => srv.once("listening", r));
  const port = srv.address().port;
  await assert.rejects(fetchPublic(`http://127.0.0.1:${port}/`), /URL blocked/);
  await assert.rejects(fetchPublic("file:///etc/passwd"), /URL blocked/);
  srv.close();
});

test("redirect to private address is blocked (rebinding via lookup)", async () => {
  // 'public.test' resolves to loopback through a malicious resolver; connect-time filter must refuse.
  const lookup = makeSafeLookup((h, o, cb) => cb(null, [{ address: "127.0.0.1", family: 4 }]));
  await assert.rejects(fetchPublic("http://public.test/", { lookup, timeoutMs: 2000 }), /blocked address/);
});

test("html to text and ddg parsing", () => {
  assert.equal(htmlToText("<p>Hi <b>there</b></p><script>x()</script>"), "Hi there");
  const html = `<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa&rut=1">Ex &amp; A</a><a class="result__snippet">snip</a>
  <a class="result__a" href="//duckduckgo.com/l/?uddg=http%3A%2F%2F127.0.0.1%2F">Evil</a>`;
  const r = parseDuckDuckGo(html); assert.equal(r.length, 1); assert.equal(r[0].url, "https://example.com/a");
});
