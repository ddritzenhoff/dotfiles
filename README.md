# .config

Live dotfiles repository at `~/.config`.

## Components

- `zsh/`: shell configuration
- `nvim/`: Neovim configuration
- `ghostty/`: Ghostty terminal configuration
- [`herdr-app/`](herdr-app/README.md): Herdr settings, shortcuts and personal layouts;
  [herdr-changes](https://github.com/ddritzenhoff/herdr-changes) is a pinned Git
  submodule, linked into the live app rather than copied here.

After cloning, run `sh herdr-app/integrations/changes/setup.sh` to initialize and
build Changes (Git, Cargo, Difftastic 0.72.0 and Herdr required).

Edits to tracked files apply directly and appear in Git; no sync step is needed.
Commit and push changes explicitly when ready.

