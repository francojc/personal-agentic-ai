// Scripted OpenAI-compatible mock (chat completions, SSE streaming). TEST ONLY – no network, no spend.
// Drives a deterministic research run: web_search -> web_fetch -> write_report -> final text.
import http from "node:http";

const MODE = process.env.MOCK_MODE || "research"; // research | inject | loop | costly
const DELAY = Number(process.env.MOCK_DELAY_MS || 0);
const FAIL_FIRST = Number(process.env.MOCK_FAIL_FIRST || 0);
let received = 0;
const calls = []; // request log for assertions (served at GET /__calls)

function plan(messages) {
  const toolResults = messages.filter((m) => m.role === "tool").length;
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  if (MODE === "loop" || MODE === "costly") return { tool: "web_fetch", args: { url: "https://example.com/?n=" + toolResults } }; // never stops: exercises tool cap
  if (toolResults === 0) return { tool: "web_search", args: { query: "example domain iana" } };
  if (toolResults === 1) return { tool: "web_fetch", args: { url: MODE === "inject" ? "http://127.0.0.1:8081/health" : "https://example.com/" } };
  if (toolResults === 2) return { tool: "write_report", args: { content: "# Example Domain\n\nExample.com is reserved for documentation use. Source: https://example.com/\n" } };
  return { text: "Report written to report.md. (mock)" };
}

function sse(res, chunks) { res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" }); for (const c of chunks) res.write(`data: ${JSON.stringify(c)}\n\n`); res.write("data: [DONE]\n\n"); res.end(); }
const base = (model) => ({ id: "chatcmpl-mock", object: "chat.completion.chunk", created: 1, model });

http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/__calls") { res.end(JSON.stringify(calls)); return; }
  if (req.method !== "POST" || !req.url.endsWith("/chat/completions")) { res.writeHead(404).end(); return; }
  let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => setTimeout(() => {
    received++;
    if (received <= FAIL_FIRST) { calls.push({ failed: true }); return res.writeHead(503, { "content-type": "application/json" }).end(JSON.stringify({ error: { message: "mock overloaded", type: "server_error" } })); }
    const j = JSON.parse(body); const p = plan(j.messages || []);
    calls.push({ model: j.model, stream: !!j.stream, tools: (j.tools || []).map((t) => t.function?.name), nmsg: (j.messages || []).length, auth: req.headers.authorization ? "present" : "none" });
    const big = MODE === "costly" ? 1_000_000 : 0; // 1M prompt tokens ~ $0.30/turn at the configured price
    const usage = { prompt_tokens: big + 400 + (j.messages || []).length * 50, completion_tokens: 60, total_tokens: big + 460 + (j.messages || []).length * 50 };
    const m = j.model;
    if (p.tool) {
      const tc = { index: 0, id: "call_" + calls.length, type: "function", function: { name: p.tool, arguments: JSON.stringify(p.args) } };
      if (j.stream) return sse(res, [{ ...base(m), choices: [{ index: 0, delta: { role: "assistant", content: null, tool_calls: [tc] }, finish_reason: null }] }, { ...base(m), choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }, { ...base(m), choices: [], usage }]);
      return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ...base(m), object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls: [{ ...tc, index: undefined }] }, finish_reason: "tool_calls" }], usage }));
    }
    if (j.stream) return sse(res, [{ ...base(m), choices: [{ index: 0, delta: { role: "assistant", content: p.text }, finish_reason: null }] }, { ...base(m), choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }, { ...base(m), choices: [], usage }]);
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ...base(m), object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: p.text }, finish_reason: "stop" }], usage }));
  }, DELAY));
}).listen(9099, "0.0.0.0", () => console.log("mock-zen on :9099 mode=" + MODE));
