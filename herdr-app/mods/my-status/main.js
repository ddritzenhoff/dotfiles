import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, terminals, focused, theme, run, window, keys, appHome, readTextFile, writeTextFile } from "herdr";
import { parseMetrics, metricsText, effortColor } from "./metrics.js";
import { FocusScrollbars, scrollbarsForFocus } from "./scrollbars.js";

export default class WorkspaceStatus extends View {
  init() {
    const path = `${appHome()}/settings.json`;
    this.scrollbars = new FocusScrollbars(
      () => readTextFile(path),
      (text, expected) => writeTextFile(path, text, expected),
    );
  }

  async close() {
    await this.scrollbars?.restore();
  }

  // The palette key as actually bound, not a hardcoded one; without a
  // binding the hint stays useful ("commands") instead of lying.
  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  render(cx) {
    const t = theme();
    const space = spaces().find(s => s.active);
    const list = agents();
    const needs = list.filter(a => a.status === "blocked").length;
    const focus = focused();
    const allTerminals = terminals();
    if (window()?.active !== false && this.scrollbars?.request(scrollbarsForFocus(focus, list, allTerminals))) {
      cx.spawn(async () => {
        try { await this.scrollbars.flush(); }
        catch (error) { console.warn(`[my-status scrollbars] ${error.message}`); }
      });
    }
    const address = focus?.shown ?? focus?.terminal;
    const agent = list.find(a => a.address === address);
    const isPi = agent?.app === "pi" || agent?.program?.key === "pi";
    const data = isPi ? parseMetrics(allTerminals.find(a => a.address === address)) : null;
    const width = this.width ?? 1200;
    const label = (icon, text) => h_flex().gap(6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(13)).child(text);
    const metric = (id, text, detail, color = t.muted) => div().id(id).flex_shrink_0()
      .text_color(color).tooltip(detail).child(text);
    const bar = h_flex().id("status-root").size_full().px(14).gap(width < 850 ? 10 : 16)
      .on_size_change((size, cx) => {
        if (this.width !== size.width) { this.width = size.width; cx.notify(); }
      })
      .items_center().overflow_hidden().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .when(!isPi || width >= 650, el => el.child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer")))
      .when(Boolean(space?.branch) && width >= 1000, el => el.child(label("branch", space.branch)))
      .when(!isPi || width >= 750, el => el.child(h_flex().gap(6).items_center()
        .child(div().size(6).rounded(3).bg(t.dim)).child(`${list.length} agents`)
        .when(needs > 0, el => el.child(div().text_color(t.blocked).child(`· ${needs} needs you`)))))
      .child(div().flex_1());
    if (data) {
      const text = metricsText(data);
      const separator = () => div().text_color(t.dim).child("·");
      const metrics = h_flex().gap(7).items_center().flex_shrink_0()
        .child(metric("pi-reasoning", text.reasoning, "Pi's configured reasoning effort, not an estimate of task difficulty.", effortColor(data, t)))
        .child(separator())
        .child(metric("pi-context", text.context, `${text.contextDetail}\n\n${text.detail}`,
          data.contextPercent >= 90 ? t.blocked : data.contextPercent >= 75 ? t.working : t.muted));
      if (data.model) metrics.child(separator()).child(div().id("pi-model").max_w(width < 650 ? 100 : 160).truncate()
        .tooltip(`${data.provider ?? "Pi"} / ${data.model}`).child(data.model));
      bar.child(metrics.child(separator()).child(metric("pi-cache", width < 650 ? text.cacheCompact : text.cache,
        `${text.cacheDetail}\n\n${text.detail}`)));
    } else if (isPi) {
      bar.child(metric("pi-unavailable", "Pi stats: /reload to connect",
        "Run /reload in this Pi session to load the Herdr metrics extension. Other agents do not report these metrics yet.", t.dim));
    }
    return bar.when(width >= 850, el => el.child(div().id("palette").text_color(t.dim)
      .on_click(() => run("app.palette")).child(this.hint(t))));
  }
}
