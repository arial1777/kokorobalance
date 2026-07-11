#!/usr/bin/env bash
# backend/.env.production.local の値を GCP Secret Manager (orange-note-dev) に同期する。
# シークレット名には kokorobalance- 接頭辞を付け、同一プロジェクト内の他アプリ(oshinomi)の
# シークレットと衝突しないようにする。値は標準入力経由で渡し、コンソール出力には残さない。

set -euo pipefail

PROJECT_ID="orange-note-dev"
ENV_FILE="$(dirname "$0")/../.env.production.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "Not found: $ENV_FILE" >&2
  exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    ''|'#'*) continue ;;
  esac

  key="${line%%=*}"
  value="${line#*=}"

  if [ -z "$value" ]; then
    echo "skip (empty): $key"
    continue
  fi

  secret_name="kokorobalance-${key}"

  if gcloud secrets describe "$secret_name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$secret_name" --project="$PROJECT_ID" --data-file=- >/dev/null
    echo "updated: $secret_name"
  else
    printf '%s' "$value" | gcloud secrets create "$secret_name" --project="$PROJECT_ID" --replication-policy=automatic --data-file=- >/dev/null
    echo "created: $secret_name"
  fi
done < "$ENV_FILE"
