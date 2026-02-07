#!/usr/bin/env bash
# sync-docs.sh — Index workspace markdown files into Convex documents table
# Scans /root/clawd/*.md and /root/clawd/memory/*.md
set -euo pipefail

CONVEX_URL="${MC_CONVEX_URL:-https://careful-gnat-191.convex.cloud}"
WORKSPACE="/root/clawd"
MAX_CONTENT_SIZE=8000

QUIET=false
if [ "${1:-}" = "--quiet" ] || [ "${1:-}" = "-q" ]; then
  QUIET=true
fi

log() {
  if [ "$QUIET" = false ]; then
    echo "$@"
  fi
}

log "📄 Syncing workspace documents → Convex..."

DOC_COUNT=0
ERROR_COUNT=0

# Function to index a single file
index_file() {
  local filepath="$1"
  local doctype="$2"

  if [ ! -f "$filepath" ]; then
    return 0
  fi

  local filename
  filename=$(basename "$filepath")

  # Read content (first 8000 chars) and JSON-encode it
  local content
  content=$(head -c "$MAX_CONTENT_SIZE" "$filepath" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null) || {
    log "  ⚠️  Failed to read: $filename"
    ERROR_COUNT=$((ERROR_COUNT + 1))
    return 0
  }

  # Build payload
  local payload
  payload="{\"path\":\"documents:upsert\",\"args\":{\"path\":\"$filepath\",\"name\":\"$filename\",\"content\":$content,\"type\":\"$doctype\"},\"format\":\"json\"}"

  # POST to Convex
  if curl -s -f -X POST "$CONVEX_URL/api/mutation" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    -o /dev/null 2>/dev/null; then
    log "  ✅ $filename ($doctype)"
    DOC_COUNT=$((DOC_COUNT + 1))
  else
    log "  ❌ $filename (failed to sync)"
    ERROR_COUNT=$((ERROR_COUNT + 1))
  fi
}

# Index config files (workspace root .md files)
log ""
log "Config files:"
for file in "$WORKSPACE"/*.md; do
  index_file "$file" "config"
done

# Index memory files
log ""
log "Memory files:"
if [ -d "$WORKSPACE/memory" ]; then
  for file in "$WORKSPACE/memory"/*.md; do
    index_file "$file" "memory"
  done
else
  log "  (no memory directory found)"
fi

log ""
log "✅ Indexed $DOC_COUNT documents ($ERROR_COUNT errors)"

# Exit with error code if all failed
if [ "$DOC_COUNT" -eq 0 ] && [ "$ERROR_COUNT" -gt 0 ]; then
  exit 1
fi
