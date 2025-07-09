#!/bin/bash

# WhatsApp Bot Server Management Script

echo "🚀 Starting WhatsApp Bot Server..."

# Check if server is already running
if pgrep -f "ts-node-dev.*wa_baileys_erp" > /dev/null; then
    echo "❌ Server is already running!"
    echo "Use './stop.sh' to stop it first."
    exit 1
fi

# Start the server
npm run dev &

# Save the process ID
echo $! > .server.pid

echo "✅ Server started with PID: $(cat .server.pid)"
echo "🌐 Open http://localhost:3000 in your browser"
echo "📱 Scan the QR code to connect WhatsApp"
echo ""
echo "To stop the server, run: ./stop.sh" 