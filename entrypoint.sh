#!/bin/sh
set -eu

BRAND_LINK=0
case "${PLOTX_BRAND_LINK:-0}" in
  1|true|TRUE|True)
    BRAND_LINK=1
    ;;
  *)
    BRAND_LINK=0
    ;;
esac

cat <<EOF > /usr/share/nginx/html/config.js
window.PLOTX_CONFIG = { brandLink: ${BRAND_LINK} };
EOF

exec nginx -g 'daemon off;'
