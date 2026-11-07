import assert from "node:assert/strict";
import { test } from "node:test";
import extension, { snapshot, usageTotals, renderedEffortColor, latestCacheHitRate, emptyFooter } from "../integrations/pi/herdr-status.ts";

const usage = (input, output, cacheRead = 0, cacheWrite = 0, cost = 0) => ({
  input, output, cacheRead, cacheWrite, cost: { total: cost },
});
const entries = [
  { type: "message", message: { role: "assistant", usage: usage(10, 2, 30, 5, 0.1) } },
  { type: "message", message: { role: "user", content: "Never exported" } },
  { type: "message", message: { role: "toolResult", usage: usage(3, 4) } },
  { type: "compaction", usage: usage(6, 7) },
  { type: "branch_summary", usage: usage(8, 9) },
  { type: "usage", kind: "cache_warm", usage: usage(0, 0, 100) },
];
const ctx = {
  mode: "tui",
  ui: { setFooter() {} },
  model: { id: "test-model", provider: "test-provider" },
  thinkingLevel: "high",
  sessionManager: {
    getSessionId: () => "test-session",
    getEntries: () => entries,
  },
  getContextUsage: () => ({ tokens: 200, contextWindow: 1000, percent: 20 }),
};

function harness() {
  const handlers = new Map();
  const calls = [];
  const pi = {
    on: (event, handler) => handlers.set(event, handler),
    getThinkingLevel: () => "medium",
    exec: async (command, args) => { calls.push([command, args]); return { code: 0 }; },
  };
  extension(pi);
  return { calls, handlers, pi };
}

async function withTerminal(fn) {
  const previous = process.env.HC_TERMINAL_ID;
  process.env.HC_TERMINAL_ID = "test-terminal";
  try { await fn(); }
  finally {
    if (previous === undefined) delete process.env.HC_TERMINAL_ID;
    else process.env.HC_TERMINAL_ID = previous;
  }
}

test("usage matches Pi's full-session accounting, including nested calls and cache", () => {
  assert.deepEqual(usageTotals(entries), {
    input: 27, output: 22, cacheRead: 130, cacheWrite: 5, cost: 0.1,
  });
});

test("cache hit rate matches Pi's latest assistant prompt, not cumulative cache totals", () => {
  assert.equal(latestCacheHitRate(entries), 30 / 45 * 100);
  assert.equal(latestCacheHitRate([]), null);
  assert.equal(latestCacheHitRate([...entries, { type: "message", message: {
    role: "assistant", usage: usage(0, 1, 100),
  } }]), 100);
  assert.equal(latestCacheHitRate([...entries, { type: "message", message: {
    role: "assistant", usage: usage(0, 0),
  } }]), null);
});

test("footer renders zero rows only in Herdr's interactive session and is restored on teardown", async () => {
  assert.deepEqual(emptyFooter().render(100), []);
  await withTerminal(async () => {
    const footers = [];
    const context = { ...ctx, ui: { setFooter: factory => footers.push(factory) } };
    const { handlers } = harness();
    await handlers.get("session_start")({}, context);
    assert.deepEqual(footers[0]().render(100), []);
    await handlers.get("session_shutdown")({}, context);
    assert.equal(footers[1], undefined);
    for (const mode of ["rpc", "print", "json"]) {
      const { handlers } = harness();
      await handlers.get("session_start")({}, { ...context, mode });
    }
    assert.equal(footers.length, 2);
  });
});

test("snapshot contains metrics only, with nullable context after compaction", () => {
  const data = snapshot(ctx, "high");
  assert.equal(data.pid, process.pid);
  assert.equal(data.level, "high");
  assert.equal(data.contextPercent, 20);
  assert.equal(data.cacheHitRate, 30 / 45 * 100);
  assert.ok(!JSON.stringify(data).includes("Never exported"));
  const unknown = snapshot({ ...ctx, getContextUsage: () => undefined }, "off");
  assert.equal(unknown.contextTokens, null);
  assert.equal(unknown.contextPercent, null);
});

test("effort color comes from Pi's actual bar formatter, including terminal palettes", () => {
  const styled = ansi => ({ ...ctx, ui: { theme: { getThinkingBorderColor: level => {
    assert.equal(level, "high");
    return text => `${ansi}${text}\x1b[39m`;
  } } } });
  assert.equal(renderedEffortColor(styled("\x1b[38;2;151;118;229m"), "high"), "#9776e5");
  assert.equal(renderedEffortColor(styled("\x1b[38;5;141m"), "high"), "#af87ff");
  assert.equal(renderedEffortColor(styled("\x1b[38;5;244m"), "high"), "#808080");
  assert.equal(renderedEffortColor(styled("\x1b[38;5;5m"), "high"), "ansi5");
  assert.equal(renderedEffortColor(styled("\x1b[95m"), "high"), "ansi13");
  assert.equal(snapshot(styled("\x1b[38;2;171;205;239m"), "high").effortColor, "#abcdef");
});

test("publishes once, follows reasoning changes and clears on shutdown", async () => {
  await withTerminal(async () => {
    const { handlers, calls } = harness();
    await handlers.get("session_start")({}, ctx);
    await handlers.get("turn_end")({}, ctx);
    assert.equal(calls.length, 1);
    const value = JSON.parse(calls[0][1][2].slice("pi.metrics=".length));
    assert.equal(value.level, "high");
    await handlers.get("thinking_level_select")({}, { ...ctx, thinkingLevel: "low" });
    assert.equal(calls.length, 2);
    await handlers.get("session_shutdown")({ reason: "reload" }, ctx);
    assert.deepEqual(calls.at(-1), ["hc", ["label", "test-terminal", "pi.metrics="]]);
    await handlers.get("turn_end")({}, ctx);
    assert.equal(calls.length, 3);
  });
});

test("model changes, context changes, session replacement and fallback level", async () => {
  await withTerminal(async () => {
    const { handlers, calls } = harness();
    await handlers.get("session_start")({}, { ...ctx, thinkingLevel: undefined });
    assert.equal(JSON.parse(calls[0][1][2].slice(11)).level, "medium");
    await handlers.get("model_select")({}, { ...ctx, model: { id: "other", provider: "test" } });
    assert.equal(JSON.parse(calls[1][1][2].slice(11)).model, "other");
    await handlers.get("session_compact")({}, { ...ctx, getContextUsage: () => undefined });
    assert.equal(JSON.parse(calls[2][1][2].slice(11)).contextPercent, null);
    await handlers.get("session_shutdown")({}, ctx);
    await handlers.get("session_start")({}, ctx);
    assert.equal(calls.length, 5);
  });
});

test("inherited print/RPC children and sessions outside Herdr never publish", async () => {
  await withTerminal(async () => {
    for (const mode of ["print", "json", "rpc"]) {
      const { handlers, calls } = harness();
      await handlers.get("session_start")({}, { ...ctx, mode });
      await handlers.get("agent_settled")({}, ctx);
      await handlers.get("session_shutdown")({}, ctx);
      assert.equal(calls.length, 0);
    }
    delete process.env.HC_TERMINAL_ID;
    assert.equal(harness().handlers.size, 0);
  });
});

test("core failures do not break Pi and can be retried", async () => {
  await withTerminal(async () => {
    const { handlers, calls, pi } = harness();
    const previousWarn = console.warn;
    console.warn = () => {};
    pi.exec = async () => { throw new Error("core unavailable"); };
    try {
      await handlers.get("session_start")({}, ctx);
      pi.exec = async (command, args) => { calls.push([command, args]); return { code: 0 }; };
      await handlers.get("turn_end")({}, ctx);
      assert.equal(calls.length, 1);
    } finally { console.warn = previousWarn; }
  });
});
