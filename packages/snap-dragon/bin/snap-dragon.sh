#! /bin/bash
real0=$(readlink "${BASH_SOURCE[0]}" || echo "${BASH_SOURCE[0]}")
thisdir=$(cd "$(dirname -- "$real0")" && pwd -P)
nodeFlags=()
while test $# -gt 0; do
  case "$1" in
  --inspect*) nodeFlags+=( "$1" ) ;;
  *) break ;;
  esac
  shift
done

exec node ${nodeFlags[@]} "$thisdir/../src/entrypoint.js" ${1+"$@"}
