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
  padding is zero. Split panes keep their headers and focus outlines.
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
