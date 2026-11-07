export function parseMetrics(terminal) {
  try {
    const data = JSON.parse(terminal?.labels?.["pi.metrics"] ?? "null");
    if (!data || data.v !== 1 || !Number.isInteger(data.pid) || data.pid <= 0) return null;
    // Core labels survive an agent returning to its shell. Never reuse an old
    // process's numbers when a different agent starts in that same terminal.
    if (terminal?.foreground?.pid !== data.pid) return null;
    if (typeof data.session !== "string" || typeof data.level !== "string") return null;
    if (!["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(data.level)) return null;
    if (![data.input, data.output, data.cacheRead, data.cacheWrite, data.cost]
      .every(value => Number.isFinite(value) && value >= 0)) return null;
    for (const key of ["contextTokens", "contextWindow", "contextPercent"]) {
      if (data[key] !== null && !(Number.isFinite(data[key]) && data[key] >= 0)) return null;
    }
    if (data.cacheHitRate != null && !(Number.isFinite(data.cacheHitRate) && data.cacheHitRate >= 0 && data.cacheHitRate <= 100)) return null;
    if (data.model !== null && typeof data.model !== "string") return null;
    if (data.provider !== null && typeof data.provider !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

export function compact(value) {
  if (value < 1000) return String(Math.round(value));
  if (value < 1e6) return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${(value / 1e6).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}M`;
}

// Pi's built-in dark palette, used until an existing session reloads the
// bridge. Reloaded sessions report their actual rendered theme color.
const effortColors = {
  off: "#6c767b", minimal: "#68808d", low: "#5489a4", medium: "#6185cc",
  high: "#9776e5", xhigh: "#de54c1", max: "#fe5462",
};

export function effortColor(data, theme) {
  const color = data.effortColor;
  if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) return color;
  if (typeof color === "string" && /^ansi(?:[0-9]|1[0-5])$/.test(color)) return theme[color];
  return effortColors[data.level];
}

export function metricsText(data) {
  const hit = data.cacheHitRate == null ? "" : `${data.cacheHitRate.toFixed(1)}%`;
  const cacheCounts = `R${compact(data.cacheRead)}${data.cacheWrite > 0 ? ` W${compact(data.cacheWrite)}` : ""}`;
  return {
    reasoning: data.level,
    context: `${data.contextTokens === null ? "—" : compact(data.contextTokens)}/${data.contextWindow === null ? "—" : compact(data.contextWindow)}${data.contextPercent === null ? "" : ` (${data.contextPercent.toFixed(1)}%)`}`,
    cache: `cache ${hit ? `${hit} ` : ""}${cacheCounts}`,
    cacheCompact: `cache ${hit || cacheCounts}`,
    cacheDetail: `${data.cacheHitRate == null ? "Latest prompt cache-hit rate unavailable until a model response / bridge reload." : `Latest prompt cache-hit rate: ${data.cacheHitRate.toFixed(1)}% (cache reads / total prompt input).`}\nR / W are cumulative session cache read / write tokens.`,
    detail: [
      "Focused Pi session · cumulative reported usage (all session history)",
      `Input: ${data.input.toLocaleString()} uncached + ${data.cacheRead.toLocaleString()} cache read + ${data.cacheWrite.toLocaleString()} cache write`,
      `Output: ${data.output.toLocaleString()} tokens`,
      `Estimated API cost: $${data.cost.toFixed(3)} (not a subscription bill)`,
      "Usage updates after completed model turns, not token-by-token.",
    ].join("\n"),
    contextDetail: data.contextTokens === null || data.contextWindow === null
      ? "Context estimate unavailable until the next model response."
      : `Estimated current context: ${data.contextTokens.toLocaleString()} / ${data.contextWindow.toLocaleString()} tokens (${data.contextPercent === null ? "unknown" : `${data.contextPercent.toFixed(1)}%`})`,
  };
}
