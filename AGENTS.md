# Dotfiles

This repository lives directly at `~/.config`; tracked configuration is also
live configuration. Preserve unrelated working-tree changes. Do not commit or
push unless asked.

## Herdr

- Keep personal Herdr configuration in this repo's `herdr-app/` component.
  Changes is maintained only in the `herdr-app/vendor/herdr-changes` Git submodule
  (https://github.com/ddritzenhoff/herdr-changes), not duplicated in dotfiles.
  `mods/review`, `mods/review-tabs` and `tools/review-backend` are live symlinks
  into it. `~/programming/changes` is a convenience link to the same checkout.
  Commit/push Changes code in that repository first, then update the submodule
  reference in dotfiles. Never replace its links with copied source or run the
  copy-based upstream installer over this linked setup. Read `herdr-app/README.md`
  for tracking, build and restore steps. After Changes code/asset edits, save
  unsaved review comments and run `sh herdr-app/integrations/changes/setup.sh`
  to rebuild/check and reload the linked mods; Herdr does not watch `vendor/`.
- Read the app-generated `herdr-app/AGENTS.md` before changing Herdr. Do not
  edit or version it, the generated `.d.ts` files, or session/runtime state.
- The personal layout is `herdr-app/layouts/my-layout.json`. Preserve its
  frameless single-pane behavior, zero vertical gutter and balanced 4px
  horizontal wrapper insets unless asked otherwise.
- Use personal files; clone shipped layouts/mods before structural/code edits.
- Keep settings, shortcuts, personal layouts/mods/themes and their assets
  eligible for Git tracking. Update `herdr-app/.gitignore` for new asset paths
  or newly shipped components. Never force-add generated or private files.
- After changes, verify `herdr-app status` has no errors. Custom mods must pass
  `herdr-app check <folder>` and be checked in the app.
- Changes to existing tracked files are already reflected in Git; new files
  need adding. Review the scoped Git diff/status and report uncommitted changes.
