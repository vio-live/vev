#!/usr/bin/env bash
# Publica una release de los bloques de Kondomeriet para que otros la instalen en su
# propia cuenta de Vev (Partner Studio). Se ejecuta desde un checkout limpio de main.
#
#   kondomeriet/scripts/release.sh 1.0.0 notas.md [tutorial.pdf]
#
# El zip lleva la carpeta kondomeriet/ sin scripts/ y con un vev.json SIN clave:
# `vev init` en su cuenta añade la suya y conserva shareWithAccount.
set -euo pipefail

version="${1:?versión, p. ej. 1.0.0}"
notes="${2:?archivo con las notas de la release}"
pdf="${3:-}"
tag="kondomeriet-v${version}"
root="$(git rev-parse --show-toplevel)"
cd "$root"

if [ -n "$(git status --porcelain -- kondomeriet)" ]; then
  echo "kondomeriet/ tiene cambios sin commitear" >&2; exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
dir="$work/kondomeriet-vev"
mkdir -p "$dir"
git archive HEAD:kondomeriet | tar -x -C "$dir"
rm -rf "$dir/scripts"
printf '{\n  "shareWithAccount": true\n}\n' > "$dir/vev.json"
node -e 'const p=require(process.argv[1]);p.version=process.argv[2];delete p.scripts["sdk-lite"];require("fs").writeFileSync(process.argv[1],JSON.stringify(p,null,2)+"\n")' "$dir/package.json" "$version"

zip="$work/kondomeriet-vev-v${version}.zip"
(cd "$work" && zip -qr "$zip" kondomeriet-vev)

assets=("$zip")
[ -n "$pdf" ] && assets+=("$pdf")

git tag -a "$tag" -m "Kondomeriet v${version}"
git push origin "$tag"
gh release create "$tag" "${assets[@]}" --title "Kondomeriet v${version}" --notes-file "$notes" --latest=false
