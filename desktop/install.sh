#!/usr/bin/env bash
set -eu

fail() { printf '%s\n' "$*" >&2; exit 1; }

[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] ||
  fail 'Este pacote é para Linux x86_64.'
[[ $EUID != 0 ]] || fail 'Execute o instalador como seu usuário de desktop.'

package=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
revision=$(cat -- "$package/app/resources/app/REVISION")
[[ $revision =~ ^[0-9a-f]{40}$ && -x "$package/app/mares-de-ambar" ]] ||
  fail 'O pacote de instalação está incompleto.'

data_home=${XDG_DATA_HOME:-"$HOME/.local/share"}
[[ $data_home == /* ]] || data_home="$HOME/.local/share"
desktop_home="$HOME/Desktop"
if command -v xdg-user-dir >/dev/null; then
  desktop_home=$(xdg-user-dir DESKTOP) || desktop_home="$HOME/Desktop"
fi
# XDG reports HOME itself when the desktop directory has been disabled.
[[ -n "$desktop_home" && "$desktop_home" != "$HOME" ]] || desktop_home=
root="$data_home/mares-de-ambar"
release="$root/releases/$revision"
menu="$data_home/applications/mares-de-ambar.desktop"
shortcut=
[[ -z "$desktop_home" ]] || shortcut="$desktop_home/Marés de Âmbar.desktop"

mkdir -p -- "$root/releases" "$(dirname -- "$menu")"
exec 9>"$root/.install.lock"
flock 9
for launcher in "$menu" "$shortcut"; do
  [[ -n "$launcher" ]] || continue
  if [[ -L "$launcher" ]] || { [[ -e "$launcher" ]] && ! grep -Fxq 'X-Mares-De-Ambar=true' "$launcher"; }; then
    fail "Já existe um atalho de outro aplicativo em $launcher."
  fi
done
if [[ -e "$root/current" && ! -L "$root/current" ]]; then
  fail "O caminho $root/current está ocupado."
fi

staging=$(mktemp -d -- "$root/.install.XXXXXX")
menu_tmp=
shortcut_tmp=
cleanup() {
  rm -rf -- "$staging"
  [[ -z "$menu_tmp" ]] || rm -f -- "$menu_tmp"
  [[ -z "$shortcut_tmp" ]] || rm -f -- "$shortcut_tmp"
}
trap cleanup EXIT

if [[ ! -d "$release" ]]; then
  mkdir -- "$staging/app"
  cp -a -- "$package/app/." "$staging/app/"
  mv -T -- "$staging/app" "$release"
fi
[[ -x "$release/mares-de-ambar" && -r "$release/resources/app/dist/index.html" &&
  -r "$release/resources/app/selo.png" && $(cat -- "$release/resources/app/REVISION") == "$revision" ]] ||
  fail "A edição $release está incompleta."

# Exec has a quoting layer in addition to the Desktop Entry string escaping.
executable=$(printf '%s' "$root/current/mares-de-ambar" | sed 's/\\/\\\\\\\\/g; s/["$`]/\\\\&/g; s/%/%%/g')
icon=$(printf '%s' "$root/current/resources/app/selo.png" | sed 's/\\/\\\\/g')
cat > "$staging/mares-de-ambar.desktop" <<LAUNCHER
[Desktop Entry]
Type=Application
Name=Marés de Âmbar
Comment=Estratégia medieval em tempo real
Exec="$executable"
Icon=$icon
Terminal=false
Categories=Game;StrategyGame;
StartupNotify=true
StartupWMClass=mares-de-ambar
X-Mares-De-Ambar=true
LAUNCHER

if command -v desktop-file-validate >/dev/null; then
  desktop-file-validate "$staging/mares-de-ambar.desktop"
fi
if [[ ! -x "$menu" ]] || ! cmp -s -- "$staging/mares-de-ambar.desktop" "$menu"; then
  menu_tmp=$(mktemp -- "$(dirname -- "$menu")/.mares-XXXXXX")
  install -m 0755 -- "$staging/mares-de-ambar.desktop" "$menu_tmp"
fi
if [[ -n "$shortcut" ]]; then
  mkdir -p -- "$desktop_home"
  if [[ ! -x "$shortcut" ]] || ! cmp -s -- "$staging/mares-de-ambar.desktop" "$shortcut"; then
    shortcut_tmp=$(mktemp -- "$desktop_home/.mares-XXXXXX")
    install -m 0755 -- "$staging/mares-de-ambar.desktop" "$shortcut_tmp"
  fi
fi

ln -s -- "releases/$revision" "$staging/current"
mv -Tf -- "$staging/current" "$root/current"
[[ -z "$menu_tmp" ]] || mv -Tf -- "$menu_tmp" "$menu"
if [[ -n "$shortcut_tmp" ]]; then
  mv -Tf -- "$shortcut_tmp" "$shortcut"
fi
if [[ -n "$shortcut" ]]; then
  if command -v gio >/dev/null; then
    gio set "$shortcut" metadata::trusted true 2>/dev/null || true
  fi
fi
if command -v update-desktop-database >/dev/null; then
  update-desktop-database "$(dirname -- "$menu")" || true
fi
printf 'Marés de Âmbar %s instalado em %s\n' "$revision" "$release"
[[ -z "$shortcut" ]] || printf 'Atalho em %s\n' "$shortcut"
