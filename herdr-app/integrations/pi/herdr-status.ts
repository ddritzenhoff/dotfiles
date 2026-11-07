import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";

export const METRICS_LABEL = "pi.metrics";

const count = (value: number | undefined) =>
  Number.isFinite(value) && value! >= 0 ? value! : 0;

// Match Pi's session accounting: all entries, including compacted/abandoned
// history, nested tool usage, summaries and cache warming. Cache is not output.
export function usageTotals(entries: readonly SessionEntry[]) {
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
  for (const entry of entries) {
    const usage = entry.type === "message"
      ? ((entry.message.role === "assistant" || entry.message.role === "toolResult")
        ? entry.message.usage : undefined)
      : ("usage" in entry ? entry.usage : undefined);
    if (!usage) continue;
    totals.input += count(usage.input);
    totals.output += count(usage.output);
    totals.cacheRead += count(usage.cacheRead);
    totals.cacheWrite += count(usage.cacheWrite);
    totals.cost += count(usage.cost?.total);
  }
  return totals;
}

// Read the same public formatter Pi uses for its editor bars. Using its
// rendered ANSI color also respects truecolor/256-color terminal settings.
export function renderedEffortColor(ctx: ExtensionContext, level: ThinkingLevel) {
  const styled = ctx.ui?.theme?.getThinkingBorderColor(level)("") ?? "";
  const hex = (rgb: number[]) => `#${rgb.map(n => n.toString(16).padStart(2, "0")).join("")}`;
  const rgb = styled.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/);
  if (rgb) return hex(rgb.slice(1).map(Number));
  const indexed = styled.match(/\x1b\[38;5;(\d+)m/);
  if (indexed) {
    const n = Number(indexed[1]);
    if (n < 16) return `ansi${n}`;
    if (n >= 232) return hex([1, 1, 1].map(() => 8 + (n - 232) * 10));
    const i = n - 16;
    const cube = [0, 95, 135, 175, 215, 255];
    return hex([cube[Math.floor(i / 36)], cube[Math.floor(i / 6) % 6], cube[i % 6]]);
  }
  const basic = styled.match(/\x1b\[(3[0-7]|9[0-7])m/);
  if (basic) {
    const n = Number(basic[1]);
    return `ansi${n >= 90 ? n - 90 + 8 : n - 30}`;
  }
  return null;
}

export function latestCacheHitRate(entries: readonly SessionEntry[]) {
  let rate: number | null = null;
  for (const entry of entries) {
    if (entry.type !== "message" || entry.message.role !== "assistant") continue;
    const usage = entry.message.usage;
    const input = count(usage.input) + count(usage.cacheRead) + count(usage.cacheWrite);
    rate = input > 0 ? count(usage.cacheRead) / input * 100 : null;
  }
  return rate;
}

// A zero-row footer gives its space back to the transcript/editor, rather
// than drawing blank padding. Only installed in interactive Herdr sessions.
export function emptyFooter() {
  return { render: () => [] as string[], invalidate() {} };
}

export function snapshot(ctx: ExtensionContext, level: ThinkingLevel) {
  const context = ctx.getContextUsage();
  const entries = ctx.sessionManager.getEntries();
  return {
    v: 1,
    pid: process.pid,
    session: ctx.sessionManager.getSessionId(),
    model: ctx.model?.id ?? null,
    provider: ctx.model?.provider ?? null,
    level,
    effortColor: renderedEffortColor(ctx, level),
    ...usageTotals(entries),
    cacheHitRate: latestCacheHitRate(entries),
    contextTokens: context?.tokens ?? null,
    contextWindow: context?.contextWindow ?? null,
    contextPercent: context?.percent ?? null,
  };
}

// No model calls, transcript export, file writes, timers or network requests.
// Only compact metrics are sent to the local core's terminal label.
export default function (pi: ExtensionAPI) {
  const terminal = process.env.HC_TERMINAL_ID;
  if (!terminal) return;

  let active = false;
  let previous = "";
  let pending = Promise.resolve();

  function send(value: string) {
    // Serialize writes so shutdown and rapid model/level changes cannot race.
    pending = pending.then(async () => {
      const result = await pi.exec("hc", ["label", terminal!, `${METRICS_LABEL}=${value}`], {
        timeout: 1500,
        maxBuffer: 8192,
      });
      if (result.code !== 0) throw new Error("hc could not update Pi's Herdr metrics");
    }).catch((error) => {
      previous = ""; // A later event may retry without interrupting Pi's work.
      console.warn(`[herdr-status] ${error.message}`);
    });
    return pending;
  }

  function publish(ctx: ExtensionContext) {
    if (!active) return;
    const value = JSON.stringify(snapshot(ctx, ctx.thinkingLevel ?? pi.getThinkingLevel()));
    if (value === previous) return;
    previous = value;
    return send(value);
  }

  pi.on("session_start", async (_event, ctx) => {
    // Print/RPC helpers launched inside a tool inherit HC_TERMINAL_ID; they
    // must not overwrite the interactive agent's metrics on the same terminal.
    active = ctx.mode === "tui";
    if (active) ctx.ui.setFooter(emptyFooter);
    await publish(ctx);
  });
  pi.on("turn_end", async (_event, ctx) => { await publish(ctx); });
  pi.on("agent_settled", async (_event, ctx) => { await publish(ctx); });
  pi.on("model_select", async (_event, ctx) => { await publish(ctx); });
  pi.on("thinking_level_select", async (_event, ctx) => { await publish(ctx); });
  pi.on("session_compact", async (_event, ctx) => { await publish(ctx); });
  pi.on("session_tree", async (_event, ctx) => { await publish(ctx); });
  pi.on("session_shutdown", async (_event, ctx) => {
    if (!active) return;
    active = false;
    ctx.ui.setFooter(undefined);
    await send("");
  });
}
