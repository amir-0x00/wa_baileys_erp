#!/bin/bash

# WhatsApp Bot Server Stop Script

echo "🛑 Stopping WhatsApp Bot Server..."

# Check if PID file exists
if [ ! -f .server.pid ]; then
    echo "❌ No server PID file found. Server might not be running."
    
    # Try to kill any remaining processes
    pkill -f "ts-node-dev.*wa_baileys_erp" 2>/dev/null
    pkill -f "node.*wa_baileys_erp" 2>/dev/null
    
    echo "🧹 Cleaned up any remaining processes."
    exit 0
fi

# Read PID from file
PID=$(cat .server.pid)

# Check if process is still running
if ! ps -p $PID > /dev/null; then
    echo "❌ Process $PID is not running."
    rm -f .server.pid
    exit 0
fi

# Kill the process
echo "🔄 Stopping process $PID..."
kill $PID

# Wait a bit for graceful shutdown
sleep 2

# Force kill if still running
if ps -p $PID > /dev/null; then
    echo "⚡ Force killing process $PID..."
    kill -9 $PID
fi

# Clean up PID file
rm -f .server.pid

echo "✅ Server stopped successfully!" 