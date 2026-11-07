#!/bin/sh
set -eu

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
target_dir="$HOME/.pi/agent/extensions"
target="$target_dir/herdr-status.ts"
source="$source_dir/herdr-status.ts"
mkdir -p "$target_dir"

if [ -L "$target" ] && [ "$(readlink "$target")" = "$source" ]; then
  printf 'Already installed: %s\n' "$target"
elif [ -e "$target" ] || [ -L "$target" ]; then
  printf 'Refusing to overwrite existing extension: %s\n' "$target" >&2
  exit 1
else
  ln -s "$source" "$target"
  printf 'Installed: %s -> %s\n' "$target" "$source"
fi
printf 'Run /reload in existing Pi sessions; new sessions load it automatically.\n'
