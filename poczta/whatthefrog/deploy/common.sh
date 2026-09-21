#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
PROXY_DIR=/home/docker/dimundi/proxy
confirm() {
    local answer
    read -r -p "$1 [t/n]: " answer
    [[ "${answer^^}" == T ]]
}
dc() { docker compose -f compose.yml "$@"; }
proxy() { docker compose --project-directory "$PROXY_DIR" -f "$PROXY_DIR/compose.yml" "$@"; }
require_vps() {
    [[ "$PWD" == /home/docker/dimundi/whatthefrog/deploy ]] || {
        echo 'Uruchom jako docker w /home/docker/dimundi/whatthefrog/deploy.'; exit 1;
    }
    [[ "$(id -un)" == docker ]] || { echo 'Przejdz na konto docker.'; exit 1; }
}
