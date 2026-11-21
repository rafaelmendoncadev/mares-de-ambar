#!/usr/bin/env bash
set -Eeuo pipefail

project=${MARES_RELEASE_PROJECT:-}
[[ -n "$project" ]] || project=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
cd -- "$project"
state_dir=$(git rev-parse --path-format=absolute --git-common-dir)
exec 8>"$state_dir/mares-de-ambar-release.lock"
flock 8
revision=$(git rev-parse --verify refs/heads/main)
short=${revision:0:12}
target=mares-de-ambar-linux-x64
distribution="$project/distribuicao"
archive="$distribution/$target-$short.tar.gz"
archive_name=${archive##*/}
scratch=$(mktemp -d)
stage='preparação'

record() {
  local file="$state_dir/mares-de-ambar-release.status"
  printf 'estado=%s\ncommit=%s\netapa=%s\npacote=%s\n' "$1" "$revision" "$stage" "$archive" > "$file.tmp"
  mv -T -- "$file.tmp" "$file"
}

finish() {
  local result=$?
  trap - EXIT
  rm -rf -- "$scratch"
  if (( result )); then
    record falhou
    printf 'Atualização do commit %s pendente na etapa de %s.\nEstado: %s\n' \
      "$short" "$stage" "$state_dir/mares-de-ambar-release.status" >&2
  else
    record concluida
  fi
  exit "$result"
}
trap finish EXIT
record em_andamento
printf '\nAtualizando Marés de Âmbar a partir de main %s.\n' "$short"

if [[ $(uname -s) != Linux || $(uname -m) != x86_64 ]]; then
  printf 'O empacotamento exige Linux x86_64.\n' >&2
  exit 1
fi
mkdir -p -- "$distribution"
package="$scratch/$target"
if [[ -f "$archive" && -f "$archive.sha256" ]] &&
  (cd -- "$distribution" && sha256sum --check --status "$archive_name.sha256"); then
  stage='verificação do pacote existente'
  tar -xzf "$archive" -C "$scratch"
else
  stage='build do commit'
  source_tree="$scratch/source"
  mkdir -- "$source_tree"
  git archive "$revision" | tar -xf - -C "$source_tree"
  (
    cd -- "$source_tree"
    npm ci --offline --ignore-scripts --no-audit --no-fund ||
      npm ci --ignore-scripts --no-audit --no-fund
    npm run build
  )

  stage='preparação do runtime Electron'
  read -r runtime_version runtime_sha < "$source_tree/desktop/electron-linux-x64.lock"
  [[ $runtime_version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && $runtime_sha =~ ^[0-9a-f]{64}$ ]]
  runtime_archive="electron-v$runtime_version-linux-x64.zip"
  cache_home=${XDG_CACHE_HOME:-"$HOME/.cache"}
  runtime_cache="$cache_home/mares-de-ambar"
  mkdir -p -- "$runtime_cache"
  valid_runtime() {
    [[ -f "$1" ]] && printf '%s  %s\n' "$runtime_sha" "$1" | sha256sum --check --status
  }

  runtime="$runtime_cache/$runtime_archive"
  if ! valid_runtime "$runtime"; then
    for candidate in "$cache_home/electron/$runtime_archive" "$cache_home/electron/"*/"$runtime_archive"; do
      if valid_runtime "$candidate"; then
        runtime=$candidate
        break
      fi
    done
  fi
  if ! valid_runtime "$runtime"; then
    curl --fail --location --retry 2 --connect-timeout 10 \
      "https://github.com/electron/electron/releases/download/v$runtime_version/$runtime_archive" \
      -o "$scratch/$runtime_archive"
    valid_runtime "$scratch/$runtime_archive"
    mv -fT -- "$scratch/$runtime_archive" "$runtime_cache/$runtime_archive"
    runtime="$runtime_cache/$runtime_archive"
  fi

  stage='montagem e teste do aplicativo'
  mkdir -p -- "$package/app"
  unzip -q "$runtime" -d "$package/app"
  mv -- "$package/app/electron" "$package/app/mares-de-ambar"
  app="$package/app/resources/app"
  mkdir -p -- "$app"
  cp -a -- "$source_tree/dist" "$app/"
  install -m 0644 -- "$source_tree/desktop/main.cjs" "$app/main.cjs"
  install -m 0755 -- "$source_tree/desktop/install.sh" "$package/install.sh"
  install -m 0644 -- "$source_tree/desktop/LEIA-ME.txt" "$package/LEIA-ME.txt"
  printf '%s\n' "$revision" > "$app/REVISION"
  gdk-pixbuf-thumbnailer --size=256 "$source_tree/public/selo.svg" "$app/selo.png"
  (
    cd -- "$source_tree"
    node -e "const {name,version}=require('./package.json'); console.log(JSON.stringify({name,version,productName:'Marés de Âmbar',main:'main.cjs'}))" > "$app/package.json"
    if command -v xvfb-run >/dev/null && command -v xauth >/dev/null; then
      xvfb-run -a node tests/desktop-smoke.mjs "$package/app/mares-de-ambar"
    else
      node tests/desktop-smoke.mjs "$package/app/mares-de-ambar"
    fi
  )

  stage='geração do instalador'
  tar -C "$scratch" -cf - "$target" | gzip -1 > "$distribution/.$archive_name.tmp"
  mv -fT -- "$distribution/.$archive_name.tmp" "$archive"
  (cd -- "$distribution" && sha256sum "$archive_name" > ".$archive_name.sha256.tmp")
  mv -fT -- "$distribution/.$archive_name.sha256.tmp" "$archive.sha256"
fi

stage='verificação da revisão'
[[ $(cat -- "$package/app/resources/app/REVISION") == "$revision" ]]
[[ $(git rev-parse --verify refs/heads/main) == "$revision" ]] ||
  { printf 'main avançou durante o build. Execute novamente para usar o commit mais recente.\n' >&2; exit 1; }
stage='instalação no perfil do usuário'
bash "$package/install.sh"
data_home=${XDG_DATA_HOME:-"$HOME/.local/share"}
[[ $data_home == /* ]] || data_home="$HOME/.local/share"
[[ $(cat -- "$data_home/mares-de-ambar/current/resources/app/REVISION") == "$revision" ]]

stage='publicação no Git'
export GIT_TERMINAL_PROMPT=0
git -c http.lowSpeedLimit=100 -c http.lowSpeedTime=15 push origin "$revision:refs/heads/main"
remote=$(git -c http.lowSpeedLimit=100 -c http.lowSpeedTime=15 ls-remote --exit-code origin refs/heads/main)
[[ ${remote%%$'\t'*} == "$revision" ]] ||
  { printf 'O commit remoto diverge da versão instalada. Confira o histórico antes de tentar novamente.\n' >&2; exit 1; }
stage='verificação concluída'
printf 'GitHub, pacote e instalação correspondem ao commit %s.\nPacote: %s\n' "$revision" "$archive"
