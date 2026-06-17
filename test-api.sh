#!/usr/bin/env bash
# Quick smoke test for the new API endpoints
# Usage: ./test-api.sh [BASE_URL]
set -euo pipefail

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0

ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1: $2"; FAIL=$((FAIL+1)); }

echo "=== Lottie Studio API Integration Test ==="
echo "Base: $BASE"
echo ""

# 1. Create a test animation using the sakura-hello data
echo "--- Step 1: Create test animation ---"
CREATE=$(curl -sf -X POST "$BASE/api/animations" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Sakura",
    "data": {
      "v": "5.7.4", "fr": 30, "ip": 0, "op": 90, "w": 400, "h": 400,
      "nm": "Test", "ddd": 0, "assets": [],
      "layers": [{
        "ddd": 0, "ind": 0, "ty": 4, "nm": "Petal 1", "sr": 1,
        "ks": {
          "o": { "a": 0, "k": 100 },
          "r": { "a": 0, "k": 0 },
          "p": { "a": 0, "k": [200, 200, 0] },
          "a": { "a": 0, "k": [0, 0, 0] },
          "s": { "a": 0, "k": [100, 100, 100] }
        },
        "ao": 0, "ip": 0, "op": 90, "st": 0,
        "shapes": [{
          "ty": "gr", "nm": "Petal Shape",
          "it": [
            {
              "ty": "el", "nm": "Ellipse",
              "p": { "a": 0, "k": [0, -40] },
              "s": { "a": 0, "k": [40, 80] },
              "d": 1
            },
            {
              "ty": "fl", "nm": "Fill",
              "c": { "a": 0, "k": [1, 0.753, 0.796, 1] },
              "o": { "a": 0, "k": 100 },
              "r": 1
            },
            {
              "ty": "tr",
              "p": { "a": 0, "k": [0, 0] },
              "a": { "a": 0, "k": [0, 0] },
              "s": { "a": 0, "k": [100, 100] },
              "r": { "a": 0, "k": 0 },
              "o": { "a": 0, "k": 100 }
            }
          ]
        }]
      }]
    }
  }')

ID=$(echo "$CREATE" | jq -r '.id')
if [ "$ID" != "null" ] && [ -n "$ID" ]; then
  ok "Created animation: $ID"
else
  fail "Create animation" "no ID returned"
  exit 1
fi

# 2. Test GET /api/animations/:id/layers
echo ""
echo "--- Step 2: Test layers endpoint ---"
LAYERS=$(curl -sf "$BASE/api/animations/$ID/layers")

LAYER_COUNT=$(echo "$LAYERS" | jq '.layers | length')
if [ "$LAYER_COUNT" = "1" ]; then
  ok "Layer count = 1"
else
  fail "Layer count" "expected 1, got $LAYER_COUNT"
fi

LAYER_NAME=$(echo "$LAYERS" | jq -r '.layers[0].name')
if [ "$LAYER_NAME" = "Petal 1" ]; then
  ok "Layer name = 'Petal 1'"
else
  fail "Layer name" "expected 'Petal 1', got '$LAYER_NAME'"
fi

LAYER_TYPE=$(echo "$LAYERS" | jq -r '.layers[0].type')
if [ "$LAYER_TYPE" = "shape" ]; then
  ok "Layer type = 'shape'"
else
  fail "Layer type" "expected 'shape', got '$LAYER_TYPE'"
fi

SHAPE_COUNT=$(echo "$LAYERS" | jq '.layers[0].shapes | length')
if [ "$SHAPE_COUNT" = "1" ]; then
  ok "Shape count = 1 (group)"
else
  fail "Shape count" "expected 1, got $SHAPE_COUNT"
fi

# Check nested children in group
CHILDREN=$(echo "$LAYERS" | jq '.layers[0].shapes[0].children | length')
if [ "$CHILDREN" = "3" ]; then
  ok "Group children = 3 (ellipse, fill, transform)"
else
  fail "Group children" "expected 3, got $CHILDREN"
fi

FILL_COLOR=$(echo "$LAYERS" | jq -r '.layers[0].shapes[0].children[1].fillColor')
if [ "$FILL_COLOR" = "#ffc0cb" ]; then
  ok "Fill color = #ffc0cb (pink)"
else
  fail "Fill color" "expected '#ffc0cb', got '$FILL_COLOR'"
fi

CANVAS_W=$(echo "$LAYERS" | jq '.canvas.width')
if [ "$CANVAS_W" = "400" ]; then
  ok "Canvas width = 400"
else
  fail "Canvas width" "expected 400, got $CANVAS_W"
fi

# 3. Test PATCH /api/animations/:id
echo ""
echo "--- Step 3: Test PATCH endpoint ---"

# 3a. Valid patch - change fill color to red
PATCH_RESULT=$(curl -sf -X PATCH "$BASE/api/animations/$ID" \
  -H "Content-Type: application/json" \
  -d '{
    "operations": [
      { "path": "layers[0].shapes[0].it[1].c.k", "value": [1, 0, 0, 1] },
      { "path": "w", "value": 800 }
    ]
  }')

APPLIED=$(echo "$PATCH_RESULT" | jq '.appliedOperations')
if [ "$APPLIED" = "2" ]; then
  ok "PATCH applied 2 operations"
else
  fail "PATCH operations" "expected 2, got $APPLIED"
fi

# Verify the patch took effect
VERIFY=$(curl -sf "$BASE/api/animations/$ID")
NEW_W=$(echo "$VERIFY" | jq '.data.w')
if [ "$NEW_W" = "800" ]; then
  ok "Width updated to 800"
else
  fail "Width update" "expected 800, got $NEW_W"
fi

NEW_COLOR=$(echo "$VERIFY" | jq -c '.data.layers[0].shapes[0].it[1].c.k')
if [ "$NEW_COLOR" = "[1,0,0,1]" ]; then
  ok "Fill color updated to red"
else
  fail "Fill color update" "expected [1,0,0,1], got $NEW_COLOR"
fi

# 3b. Invalid path should return 400
echo ""
echo "--- Step 3b: Test PATCH with invalid path ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/animations/$ID" \
  -H "Content-Type: application/json" \
  -d '{ "operations": [{ "path": "nonexistent.path.foo", "value": 42 }] }')

if [ "$HTTP_CODE" = "400" ]; then
  ok "Invalid path returns 400"
else
  fail "Invalid path" "expected 400, got $HTTP_CODE"
fi

# 3c. Empty operations should return 400
HTTP_CODE2=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/api/animations/$ID" \
  -H "Content-Type: application/json" \
  -d '{ "operations": [] }')

if [ "$HTTP_CODE2" = "400" ]; then
  ok "Empty operations returns 400"
else
  fail "Empty operations" "expected 400, got $HTTP_CODE2"
fi

# 4. Test POST /api/animations/:id/duplicate
echo ""
echo "--- Step 4: Test duplicate endpoint ---"
DUP=$(curl -sf -X POST "$BASE/api/animations/$ID/duplicate")

DUP_ID=$(echo "$DUP" | jq -r '.id')
DUP_NAME=$(echo "$DUP" | jq -r '.name')
if [ "$DUP_ID" != "$ID" ] && [ "$DUP_ID" != "null" ]; then
  ok "Duplicate created with new ID: $DUP_ID"
else
  fail "Duplicate ID" "expected different ID"
fi

if [ "$DUP_NAME" = "Copy of Test Sakura" ]; then
  ok "Duplicate name = 'Copy of Test Sakura'"
else
  fail "Duplicate name" "expected 'Copy of Test Sakura', got '$DUP_NAME'"
fi

# Verify duplicate has the patched data (w=800)
DUP_DATA=$(curl -sf "$BASE/api/animations/$DUP_ID")
DUP_W=$(echo "$DUP_DATA" | jq '.data.w')
if [ "$DUP_W" = "800" ]; then
  ok "Duplicate preserves patched data (w=800)"
else
  fail "Duplicate data" "expected w=800, got $DUP_W"
fi

# 5. Cleanup
echo ""
echo "--- Cleanup ---"
curl -sf -X DELETE "$BASE/api/animations/$ID" > /dev/null && ok "Deleted original"
curl -sf -X DELETE "$BASE/api/animations/$DUP_ID" > /dev/null && ok "Deleted duplicate"

# 6. Rate-limit burst test (POST /api/chat — fake remote IP)
echo ""
echo "--- Step 6: Rate-limit burst test ---"
GOT_429=0
for i in $(seq 1 12); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 \
    -X POST "$BASE/api/chat" \
    -H "Content-Type: application/json" \
    -H "x-forwarded-for: 203.0.113.7" \
    -d '{"message":"ping"}' 2>/dev/null || echo "timeout")
  if [ "$HTTP_CODE" = "429" ]; then
    GOT_429=$((GOT_429+1))
  fi
done
if [ "$GOT_429" -ge 1 ]; then
  ok "Burst (12 req with fake IP) → $GOT_429 got HTTP 429"
else
  fail "Rate limit burst" "expected ≥1 HTTP 429, got 0"
fi

# 6b. Localhost bypass (no x-forwarded-for → rate limit must not trigger)
echo ""
echo "--- Step 6b: Rate-limit localhost bypass ---"
BYPASS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 \
  -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"bypass test"}' 2>/dev/null || echo "timeout")
if [ "$BYPASS_CODE" != "429" ]; then
  ok "Localhost bypass: not rate-limited (got HTTP $BYPASS_CODE)"
else
  fail "Localhost bypass" "expected NOT 429, got $BYPASS_CODE"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
