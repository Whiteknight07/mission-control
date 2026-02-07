#!/usr/bin/env bash
# OpenClaw webhook hook script
# Posts events to the MC Webhook Relay server
#
# Usage:
#   ./openclaw-hook.sh --event tool_call --title "Ran command" --desc "git push"
#   echo '{"event":"cron_fire","title":"Morning Briefing"}' | ./openclaw-hook.sh --stdin

RELAY_URL="http://127.0.0.1:3002/events"

# Parse arguments
EVENT=""
TITLE=""
DESC=""
TOOL=""
STATUS="success"
USE_STDIN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --event)
      EVENT="$2"
      shift 2
      ;;
    --title)
      TITLE="$2"
      shift 2
      ;;
    --desc|--description)
      DESC="$2"
      shift 2
      ;;
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --status)
      STATUS="$2"
      shift 2
      ;;
    --stdin)
      USE_STDIN=true
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [ "$USE_STDIN" = true ]; then
  # Read JSON from stdin and forward directly
  PAYLOAD=$(cat)
else
  # Build JSON from arguments
  if [ -z "$EVENT" ] || [ -z "$TITLE" ]; then
    echo "Usage: $0 --event <type> --title <title> [--desc <desc>] [--tool <tool>] [--status <status>]" >&2
    echo "   or: echo '{\"event\":\"...\",\"title\":\"...\"}' | $0 --stdin" >&2
    exit 1
  fi

  # Build JSON payload
  PAYLOAD=$(cat <<EOF
{
  "event": "$EVENT",
  "title": "$TITLE"
EOF
)

  if [ -n "$DESC" ]; then
    PAYLOAD="$PAYLOAD, \"description\": \"$DESC\""
  fi
  if [ -n "$TOOL" ]; then
    PAYLOAD="$PAYLOAD, \"tool\": \"$TOOL\""
  fi
  if [ -n "$STATUS" ]; then
    PAYLOAD="$PAYLOAD, \"status\": \"$STATUS\""
  fi

  PAYLOAD="$PAYLOAD }"
fi

# Send to relay
curl -s -X POST "$RELAY_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
