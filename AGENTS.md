# Dotfiles

This repository lives directly at `~/.config`; tracked configuration is also
live configuration. Preserve unrelated working-tree changes. Do not commit or
push unless asked.

## Herdr

- Keep future Herdr customizations in this repo's `herdr-app/` component, not
  in a separate copy. Read `herdr-app/README.md` for tracking and restore steps.
- Read the app-generated `herdr-app/AGENTS.md` before changing Herdr. Do not
  edit or version it, the generated `.d.ts` files, or session/runtime state.
- The personal layout is `herdr-app/layouts/my-layout.json`. Preserve its
  frameless single-pane behavior and zero outer gutter unless asked otherwise.
- Use personal files; clone shipped layouts/mods before structural/code edits.
- Keep settings, shortcuts, personal layouts/mods/themes and their assets
  eligible for Git tracking. Update `herdr-app/.gitignore` for new asset paths
  or newly shipped components. Never force-add generated or private files.
- After changes, verify `herdr-app status` has no errors. Custom mods must pass
  `herdr-app check <folder>` and be checked in the app.
- Changes to existing tracked files are already reflected in Git; new files
  need adding. Review the scoped Git diff/status and report uncommitted changes.
