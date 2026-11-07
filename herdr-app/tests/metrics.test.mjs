import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";
import { compact, metricsText, parseMetrics, effortColor } from "../mods/my-status/metrics.js";

const data = {
  v: 1, pid: 123, session: "session", model: "example", provider: "provider", level: "high",
  input: 1000, output: 250, cacheRead: 2000, cacheWrite: 50, cacheHitRate: 99.8, cost: 0.12,
  contextTokens: 300, contextWindow: 1000, contextPercent: 30,
};
const terminal = (metrics = data, pid = 123) => ({
  address: "t1", foreground: { pid }, labels: { "pi.metrics": JSON.stringify(metrics) },
});

test("validates metrics and rejects stale PIDs and malformed labels", () => {
  assert.deepEqual(parseMetrics(terminal()), data);
  for (const value of [undefined, {}, terminal(data, 456), terminal({ ...data, v: 2 }),
    terminal({ ...data, input: -1 }), terminal({ ...data, level: "made-up" }),
    terminal({ ...data, contextPercent: "30" }), terminal({ ...data, cacheHitRate: 101 }),
    { labels: { "pi.metrics": "{" } }]) {
    assert.equal(parseMetrics(value), null);
  }
});

test("context percentage is parenthesized and cache is compact with precise hover details", () => {
  const text = metricsText(data);
  assert.equal(text.reasoning, "high");
  assert.equal(text.context, "300/1k (30.0%)");
  assert.equal(text.cache, "cache 99.8% R2k W50");
  assert.equal(text.cacheCompact, "cache 99.8%");
  assert.ok(text.detail.includes("cache read"));
  assert.ok(text.detail.includes("Output: 250 tokens"));
  assert.equal(metricsText({ ...data, cacheHitRate: undefined, cacheWrite: 0 }).cache, "cache R2k");
  assert.equal(metricsText({ ...data, contextTokens: null, contextPercent: null }).context, "—/1k");
  assert.equal(metricsText({ ...data, contextTokens: 155800, contextWindow: 500000, contextPercent: 31.16 }).context, "155.8k/500k (31.2%)");
  assert.equal(compact(400), "400");
  assert.equal(compact(20000), "20k");
  assert.equal(compact(1250000), "1.25M");
});

test("effort color uses Pi's reported theme color with a purple high fallback", () => {
  assert.equal(effortColor(data, {}), "#9776e5");
  assert.equal(effortColor({ ...data, effortColor: "#aa33ff" }, {}), "#aa33ff");
  assert.equal(effortColor({ ...data, effortColor: "ansi5" }, { ansi5: "#aa00aa" }), "#aa00aa");
  assert.equal(effortColor({ ...data, effortColor: "not-a-color" }, {}), "#9776e5");
});

// Exercise the mod's conditional renders (herdr-app check only eagerly renders
// once). Native layout/interaction is also checked in the running app.
const source = (await readFile(new URL("../mods/my-status/main.js", import.meta.url), "utf8"))
  .replace(/^import .*;\n/gm, "")
  .replace("export default class WorkspaceStatus", "globalThis.Status = class WorkspaceStatus");
function render({ width = 1200, focus = { terminal: "t1" }, terminals = [terminal()],
  agents = [{ address: "t1", app: "pi", status: "working" }] } = {}) {
  const texts = [];
  const ids = [];
  const colors = new Map();
  function builder() {
    let id;
    const proxy = new Proxy({}, {
      get: (_, name) => (...args) => {
        if (name === "when") { if (args[0]) args[1](proxy); }
        else if (name === "child" && typeof args[0] === "string") texts.push(args[0]);
        else if (name === "id") { id = args[0]; ids.push(id); }
        else if (name === "text_color" && id) colors.set(id, args[0]);
        return proxy;
      },
    });
    return proxy;
  }
  const sandbox = { View: class {}, div: builder, svg: builder, h_flex: builder,
    focused: () => focus, terminals: () => terminals, agents: () => agents,
    spaces: () => [{ active: true }], theme: () => ({}), keys: () => [],
    window: () => ({ platform: "macos" }), run: () => {}, parseMetrics, metricsText, effortColor };
  vm.runInNewContext(source, sandbox);
  const status = new sandbox.Status();
  status.width = width;
  status.render();
  return { texts, ids, colors };
}

test("bar renders metrics, model and context for the focused Pi", () => {
  const { texts, ids, colors } = render();
  assert.ok(texts.includes("high"));
  assert.ok(texts.includes("300/1k (30.0%)"));
  assert.ok(texts.includes("cache 99.8% R2k W50"));
  assert.ok(!texts.some(text => text.includes("Reasoning")));
  assert.ok(!ids.includes("pi-tokens"));
  assert.equal(colors.get("pi-reasoning"), "#9776e5");
  assert.deepEqual(ids.filter(id => ["pi-reasoning", "pi-context", "pi-model", "pi-cache"].includes(id)),
    ["pi-reasoning", "pi-context", "pi-model", "pi-cache"]);
});

test("narrow bar keeps the requested metrics and hides secondary information", () => {
  const { texts, ids } = render({ width: 500 });
  assert.ok(texts.includes("high"));
  assert.ok(texts.includes("300/1k (30.0%)"));
  assert.ok(texts.includes("cache 99.8%"));
  assert.ok(ids.includes("pi-model"));
  assert.ok(!ids.includes("palette"));
});

test("switching to a shell/mod never displays the previous agent's usage", () => {
  for (const focus of [{ terminal: "t2" }, { terminal: null }, null]) {
    assert.ok(!render({ focus }).ids.includes("pi-context"));
  }
  assert.ok(!render({ agents: [{ address: "t1", app: "codex" }] }).ids.includes("pi-context"));
  assert.ok(render({ terminals: [terminal(data, 456)] }).ids.includes("pi-unavailable"));
  assert.ok(render({ focus: { terminal: "t2", shown: "t1" } }).ids.includes("pi-context"));
});
