#!/usr/bin/env bash
set -euo pipefail
[[ $# == 1 ]] || exit 1
getent ahostsv4 dimundi-roundcube | awk -v candidate="$1" '
    $1 == candidate { found = 1 }
    END { exit !found }
'
