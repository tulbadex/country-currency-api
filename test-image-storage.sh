#!/bin/bash

# Quick test for image storage functionality

echo "🧪 Testing Image Storage Functionality"
echo "====================================="

API_URL="http://54.241.80.160"

# Test 1: Check if API is running
echo "1️⃣ Testing API availability..."
status=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/status)
if [ "$status" = "200" ]; then
    echo "✅ API is running"
else
    echo "❌ API not responding (Status: $status)"
    exit 1
fi

# Test 2: Refresh countries data
echo ""
echo "2️⃣ Refreshing countries data..."
refresh_response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST $API_URL/countries/refresh)
refresh_status=$(echo "$refresh_response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')

if [ "$refresh_status" = "200" ]; then
    echo "✅ Countries data refreshed successfully"
else
    echo "❌ Failed to refresh countries (Status: $refresh_status)"
    echo "Response: $(echo "$refresh_response" | sed -E 's/HTTPSTATUS:[0-9]{3}$//')"
fi

# Test 3: Check if image/summary is generated
echo ""
echo "3️⃣ Testing image/summary endpoint..."
image_response=$(curl -s -w "HTTPSTATUS:%{http_code}" $API_URL/countries/image)
image_status=$(echo "$image_response" | tr -d '\n' | sed -E 's/.*HTTPSTATUS:([0-9]{3})$/\1/')

if [ "$image_status" = "200" ]; then
    echo "✅ Image/summary endpoint working"
    echo "Response preview:"
    echo "$(echo "$image_response" | sed -E 's/HTTPSTATUS:[0-9]{3}$//' | head -10)"
else
    echo "❌ Image endpoint failed (Status: $image_status)"
    echo "Response: $(echo "$image_response" | sed -E 's/HTTPSTATUS:[0-9]{3}$//')"
fi

# Test 4: Check cache directory (if accessible)
echo ""
echo "4️⃣ Summary of functionality:"
echo "- Countries refresh: $([ "$refresh_status" = "200" ] && echo "✅ Working" || echo "❌ Failed")"
echo "- Image generation: $([ "$image_status" = "200" ] && echo "✅ Working" || echo "❌ Failed")"

echo ""
echo "🎯 Quick test complete!"
echo "💡 Image is stored as JSON summary instead of PNG for compatibility"