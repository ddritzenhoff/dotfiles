# Herdr

This is the live Herdr configuration inside the `~/.config` dotfiles repo.
Edits in the app and edits to these files use the same files: no copying or
sync job is needed. Git records changes when you stage and commit them; it does
not automatically commit or push.

## Personal configuration

- `settings.json`: appearance, zoom, sounds and terminal preferences.
- `keys.json`: keyboard shortcuts, including Cmd+Shift+1–9 to select spaces.
  Cmd+1–9 still selects tabs; Ctrl+1–9 still selects spaces.
- `mods/my-spaces/`: personal spaces sidebar with numbered colored icons,
  including worktrees. Numbers follow space selection order and update on reorder.
- `layouts/my-layout.json`: personal clone of Herdr's `main` layout. A lone
  pane has no frame or header (`lone: false`), and the workspace's outer
  padding and terminal padding are zero. The terminal block has a tiny 4px
  horizontal wrapper inset to balance unused fractional-cell width between the
  left and right sides (no columns lost at the current window size). Split panes
  keep their headers and focus outlines.
- `mods/my-status/`: personal clone of the bottom status bar. For the focused
  Pi terminal it shows effort, current context tokens/percentage, model, then
  caching, in that order. Cumulative input/output totals remain in tooltips.
- `integrations/pi/herdr-status.ts`: Pi extension that publishes metrics to
  its core terminal's `pi.metrics` label. No prompts or conversation content
  are exported. The extension executes local `hc label`; it makes no model
  calls, network requests or file writes.
- Optional `programs.json`, personal layouts, mods, themes, fonts, backgrounds
  and `my-icons/` assets are also eligible for tracking when created.

The ignore rules exclude shipped layouts/mods/themes, generated documentation
and types, caches, sockets, click state, telemetry and terminal/session state.
Do not force-add these files. Never put credentials in tracked configuration.

## Restore

Use this repository as `~/.config` (preserve any existing configuration first),
then launch Herdr. Its shipped files are generated automatically. Activate the
personal layout with:

```sh
herdr-app do layout.switch '{"name":"my-layout"}'
```

Layout selection is local runtime state, intentionally not versioned.

Install the Pi integration (Node 22.19+ / Pi and `hc` must be installed):

```sh
sh ~/.config/herdr-app/integrations/pi/install.sh
```

This creates a symlink in `~/.pi/agent/extensions/` pointing to the tracked
extension. It refuses to overwrite another file. Run `/reload` in each existing
Pi session once; new interactive sessions discover the extension automatically.
Repeat installation on other machines if you want their Pi sessions to report
metrics too. The extension does nothing outside Herdr or in print/RPC helpers.
In interactive Herdr sessions it replaces Pi's entire two-line footer with a
zero-row component, giving that space back to the transcript/editor. Run `/reload`
after updating the extension to apply this. Pi's editor and its colored effort
bars are unchanged. Disabling the extension restores Pi's default footer.

### Bottom-bar metrics

- Metrics follow the focused terminal, not a sum of all agents. Shells, mod panes
  and other agents do not show leftover Pi metrics. A process-ID check rejects
  labels left by a previous Pi process in the same terminal.
- The bare effort label (`high`, for example) is the configured reasoning effort
  (off/minimal/low/medium/high/xhigh/max), not an inferred task difficulty. It uses
  Pi's rendered editor-bar color, including custom themes and terminal palettes.
  Run `/reload` once after updating the bridge to export that color; until then
  the bar uses Pi's built-in dark palette (`high` is purple, `#9776e5`). Model and
  effort changes update it; theme changes are reflected on the next metric update.
- **155.8k/500k (31.2%)** shows current context tokens / window size, with the
  percentage in parentheses. These are estimates, not cumulative session totals.
  It turns yellow at 75% and red at 90%; hover for unrounded counts. After
  compaction the count can be unknown until the next response.
- **Model** follows the context figures. It truncates on narrow windows rather
  than hiding completely; hover for the full provider/model name.
- **cache 99.8% R7.1M W…** comes last. The percentage is cache reads / total input
  on the latest assistant prompt, matching Pi's CH figure, not a session-wide
  average. R / W are cumulative cache read / write token counts; zero writes
  are omitted. Narrow windows show only the cache-hit rate (counts stay in the
  tooltip). Older bridges without a hit rate show the counts until `/reload`.
- Hover context or cache to see cumulative session input/output and estimated
  API cost (not a subscription bill). Totals include cache, compacted/abandoned
  history, summaries, nested tool usage and cache-warming entries, matching Pi's
  accounting. Updates happen after completed model turns, not token-by-token;
  idle cache-warming usage appears on the next update.
- The dense group is ordered: `high · 155.8k/500k (31.2%) · gpt-6.1-sol · cache 99.8% R7.1M`.
- A focused Pi without valid metrics shows `Pi stats: /reload to connect`.
  The integration currently supports Pi, not Claude Code or Codex CLI.

Validate changes (tests require a Node version with native TypeScript support,
like Node 26 used on this machine):

```sh
node --test ~/.config/herdr-app/tests/*.test.mjs
herdr-app check ~/.config/herdr-app/mods/my-status
herdr-app status
```

## Future changes

Edit the live personal files here, or change preferences in Herdr. Review with:

```sh
git -C ~/.config status --short --untracked-files=all -- herdr-app
git -C ~/.config diff -- herdr-app
git -C ~/.config add -- herdr-app
```

Then review the staged diff before committing. New personal layouts and mods
are not ignored; new root-level asset directories need an exception in
`herdr-app/.gitignore`. After Herdr upgrades, exclude any newly shipped mods,
layouts or themes before staging. Clone shipped layouts/mods before changing
them; their originals are rewritten on startup.

After editing, check `herdr-app status` for errors. Check changed custom mods
with `herdr-app check <mod folder>` and inspect them in the app. Herdr rewrites
`herdr-app/AGENTS.md`; keep persistent agent guidance in `../AGENTS.md` instead.
