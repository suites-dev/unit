#!/bin/sh
set -eu
pnpm tsc -p tsconfig.cjs.json
pnpm tsc -p tsconfig.esm.json
printf '%s\n' '{"type":"module"}' > dist/esm/package.json
printf '%s\n' '{"type":"commonjs"}' > dist/cjs/package.json
