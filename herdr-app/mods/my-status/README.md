# Personal status bar

`main.js` draws the bottom bar and uses:

- `metrics.js` to format the focused Pi's metrics and effort color.
- `scrollbars.js` to control Herdr's native terminal scrollback scrollbar.

## Focus-aware scrollbars

While this mod is loaded in the personal layout, the active window follows its
focused terminal:

- A reported agent, or a program Herdr identifies as an agent: hide scrollbars.
- An ordinary terminal: show scrollbars (the thumb still needs scrollback).
- A dialog/mod pane, missing focus, or reconnecting terminal: retain the last
  decision rather than guessing. `terminal.show` replacements are followed too.

This covers Pi and other detected harnesses without requiring their own
extensions. It does not hide scrollbars drawn by a program itself.

**Herdr only provides a global flag.** This writes `pane_scrollbars` in
`~/.config/herdr-app/settings.json`, so every pane/window sharing that app home
is affected, including shell panes beside a focused agent. Inactive windows do
not initiate focus-driven writes. Only one such controller should manage a home.

The controller writes only when agent/shell focus changes, not on every render.
It re-reads settings and uses compare-and-swap to preserve concurrent changes to
other preferences. Invalid settings are never overwritten; a failed update logs
an error and is retried on a later agent/shell transition, not every redraw.
A manual scrollbar choice is left alone until the next agent/shell transition.

On layout change, mod reload/removal, or normal app shutdown, it attempts to
restore the original scrollbar preference, preserving unrelated settings and
later manual choices. Cleanup is best-effort (Herdr's 250 ms limit); after a
crash the last global value may remain until an ordinary terminal gets focus.

Since settings.json is tracked, this **runtime flag can make it appear dirty**
while an agent is focused. Do not commit the transient pane_scrollbars value as
a separate preference change; track this controller instead.

## Checks

```sh
node --test ~/.config/herdr-app/tests/metrics.test.mjs \
  ~/.config/herdr-app/tests/pi-status.test.mjs \
  ~/.config/herdr-app/tests/scrollbars.test.mjs
herdr-app check ~/.config/herdr-app/mods/my-status
herdr-app status
```

Also try focusing Pi, a normal shell, and Pi again in the app; scrollbars should
hide, show, hide without affecting terminal input or Pi's own scrolling.
