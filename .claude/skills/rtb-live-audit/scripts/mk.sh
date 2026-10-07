#!/bin/sh
# usage: mk.sh <name>  (reads tail from stdin) -> writes $TEMP/rtb-live/<name>.js
{ echo "async page => {"; cat "$(dirname "$0")/lib-round.js"; cat; echo "}"; } > "$(dirname "$0")/$1.js"
