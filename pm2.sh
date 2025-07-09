#!/bin/bash

# PM2 Management Script for WhatsApp Bot

case "$1" in
  "start")
    echo "🚀 Starting WhatsApp Bot with PM2..."
    
    # Build the project first
    echo "📦 Building project..."
    npm run build
    
    # Start with PM2
    pm2 start ecosystem.config.js --env production
    echo "✅ WhatsApp Bot started with PM2"
    echo "📊 Check status: pm2 status"
    echo "📋 View logs: pm2 logs wa-baileys-erp"
    ;;
    
  "stop")
    echo "🛑 Stopping WhatsApp Bot..."
    pm2 stop wa-baileys-erp
    echo "✅ WhatsApp Bot stopped"
    ;;
    
  "restart")
    echo "🔄 Restarting WhatsApp Bot..."
    pm2 restart wa-baileys-erp
    echo "✅ WhatsApp Bot restarted"
    ;;
    
  "reload")
    echo "🔄 Reloading WhatsApp Bot..."
    pm2 reload wa-baileys-erp
    echo "✅ WhatsApp Bot reloaded"
    ;;
    
  "delete")
    echo "🗑️  Deleting WhatsApp Bot from PM2..."
    pm2 delete wa-baileys-erp
    echo "✅ WhatsApp Bot deleted from PM2"
    ;;
    
  "logs")
    echo "📋 Showing logs..."
    pm2 logs wa-baileys-erp
    ;;
    
  "status")
    echo "📊 PM2 Status:"
    pm2 status
    ;;
    
  "monit")
    echo "📊 Opening PM2 Monitor..."
    pm2 monit
    ;;
    
  *)
    echo "Usage: $0 {start|stop|restart|reload|delete|logs|status|monit}"
    echo ""
    echo "Commands:"
    echo "  start   - Build and start the application with PM2"
    echo "  stop    - Stop the application"
    echo "  restart - Restart the application"
    echo "  reload  - Reload the application (zero-downtime)"
    echo "  delete  - Remove the application from PM2"
    echo "  logs    - Show application logs"
    echo "  status  - Show PM2 status"
    echo "  monit   - Open PM2 monitor"
    exit 1
    ;;
esac 