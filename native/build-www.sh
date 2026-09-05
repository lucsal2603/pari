#!/bin/bash
# Copia i file della web app (cartella padre) in www/, escludendo ciò che non serve all'app nativa.
set -e
cd "$(dirname "$0")"
rm -rf www && mkdir -p www
rsync -a --exclude 'native' --exclude '.git' --exclude '.gitignore' --exclude '.secrets' --exclude 'supabase' --exclude 'README.md' --exclude 'supabase.sql' --exclude '.nojekyll' ../ www/
echo "www pronta: $(find www -type f | wc -l | tr -d ' ') file"
