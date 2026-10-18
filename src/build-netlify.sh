#!/bin/sh
# Assemble the Netlify folder and zip from the page, the split data files, and the hero image.
set -e
cd "$(dirname "$0")/.."
head=$(sed -n 1,8p netlify-site/index.html)
rm -rf netlify-site.tmp && mkdir -p netlify-site.tmp
{ printf '%s\n' "$head"; sed -n '3,$p' kisah-saham-nvidia.html; printf '</body>\n</html>\n'; } > netlify-site.tmp/index.html
cp -R d netlify-site.tmp/d
cp hero.webp netlify-site.tmp/
rm -rf netlify-site && mv netlify-site.tmp netlify-site
rm -f stock-journey-netlify.zip && (cd netlify-site && zip -qr ../stock-journey-netlify.zip .)
ls -la stock-journey-netlify.zip
