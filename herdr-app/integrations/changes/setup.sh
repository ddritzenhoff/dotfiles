#!/bin/sh
# Build the pinned Changes checkout. Live paths are tracked relative symlinks;
# never copy source over them or reset an existing development checkout.
set -eu
if [ "$#" -ne 0 ]; then printf '%s\n' 'Usage: sh integrations/changes/setup.sh' >&2; exit 2; fi
APP_HOME=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
DOTFILES=$(CDPATH='' cd -- "$APP_HOME/.." && pwd)
SOURCE="$APP_HOME/vendor/herdr-changes"
if [ ! -e "$SOURCE/.git" ]; then
  git -C "$DOTFILES" submodule update --init -- herdr-app/vendor/herdr-changes
fi
for component in mods/review mods/review-tabs tools/review-backend; do
  live="$APP_HOME/$component"
  if [ ! -L "$live" ]; then
    printf 'Expected a tracked symlink: %s\nRestore it from dotfiles; refusing to overwrite files.\n' "$live" >&2
    exit 1
  fi
  actual=$(CDPATH='' cd -P -- "$live" && pwd)
  expected=$(CDPATH='' cd -P -- "$SOURCE/$component" && pwd)
  if [ "$actual" != "$expected" ]; then
    printf 'Wrong symlink target: %s\nExpected: %s\n' "$live" "$expected" >&2
    exit 1
  fi
done
sh "$SOURCE/tools/review-backend/build.sh"
herdr-app check "$APP_HOME/mods/review"
herdr-app check "$APP_HOME/mods/review-tabs"
# Herdr watches mods/, not the symlink targets under vendor/. Signal a reload
# without copying source or modifying the files in the upstream checkout.
touch -h "$APP_HOME/mods/review" "$APP_HOME/mods/review-tabs"
printf '%s\n' 'Changes is built and linked to its single source checkout.'
