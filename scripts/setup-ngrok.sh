#!/bin/bash
# Script to set up ngrok tunnel for Exotel webhooks

echo "🌐 Setting up ngrok tunnel for Exotel..."
echo ""

# Check if ngrok is running
if pgrep -x "ngrok" > /dev/null; then
    echo "⚠️  ngrok is already running"
    echo "   Getting existing tunnel URL..."
    
    # Get ngrok URL from API
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$NGROK_URL" ]; then
        echo "   Could not get URL. Please check ngrok manually."
        echo "   Or kill existing ngrok and run this script again."
        exit 1
    fi
    
    echo "✅ Found existing tunnel: $NGROK_URL"
else
    echo "📡 Starting ngrok tunnel..."
    echo "   This will run in the background"
    echo ""
    
    # Start ngrok in background
    ngrok http 3000 > /dev/null 2>&1 &
    
    # Wait for ngrok to start
    sleep 3
    
    # Get ngrok URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -z "$NGROK_URL" ]; then
        echo "❌ Failed to get ngrok URL"
        echo "   Please check ngrok manually: http://localhost:4040"
        exit 1
    fi
    
    echo "✅ ngrok tunnel started: $NGROK_URL"
fi

echo ""
echo "📝 Updating .env file with BASE_URL..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
    else
        echo "❌ .env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Update BASE_URL in .env
if grep -q "^BASE_URL=" .env; then
    # Replace existing BASE_URL
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|^BASE_URL=.*|BASE_URL=\"$NGROK_URL\"|" .env
    else
        # Linux
        sed -i "s|^BASE_URL=.*|BASE_URL=\"$NGROK_URL\"|" .env
    fi
    echo "✅ Updated BASE_URL in .env"
else
    # Add BASE_URL if it doesn't exist
    echo "" >> .env
    echo "BASE_URL=\"$NGROK_URL\"" >> .env
    echo "✅ Added BASE_URL to .env"
fi

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "📋 Configuration:"
echo "   BASE_URL: $NGROK_URL"
echo ""
echo "⚠️  IMPORTANT: Restart your server for changes to take effect!"
echo ""
echo "   pkill -f 'node server.js'"
echo "   npm start"
echo ""
echo "📊 Monitor ngrok: http://localhost:4040"
echo ""

