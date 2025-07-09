#!/bin/bash

# GitHub Actions Self-Hosted Runner Setup Script
# For wa_baileys_erp project

set -e

echo "🚀 Setting up GitHub Actions Self-Hosted Runner"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please don't run this script as root"
    exit 1
fi

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v curl &> /dev/null; then
        print_error "curl is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v git &> /dev/null; then
        print_error "git is not installed. Please install it first."
        exit 1
    fi
    
    print_status "Dependencies check passed"
}

# Install Node.js
install_nodejs() {
    print_status "Installing Node.js 18..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_warning "Node.js is already installed: $NODE_VERSION"
    else
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
        print_status "Node.js installed successfully"
    fi
}

# Install PM2
install_pm2() {
    print_status "Installing PM2..."
    
    if command -v pm2 &> /dev/null; then
        print_warning "PM2 is already installed"
    else
        npm install -g pm2
        print_status "PM2 installed successfully"
    fi
}

# Download and setup GitHub Actions runner
setup_runner() {
    print_status "Setting up GitHub Actions runner..."
    
    RUNNER_VERSION="2.311.0"
    RUNNER_DIR="$HOME/actions-runner"
    
    # Create runner directory
    mkdir -p "$RUNNER_DIR"
    cd "$RUNNER_DIR"
    
    # Download runner
    print_status "Downloading runner version $RUNNER_VERSION..."
    curl -o "actions-runner-linux-x64-$RUNNER_VERSION.tar.gz" -L "https://github.com/actions/runner/releases/download/v$RUNNER_VERSION/actions-runner-linux-x64-$RUNNER_VERSION.tar.gz"
    
    # Extract runner
    print_status "Extracting runner..."
    tar xzf "./actions-runner-linux-x64-$RUNNER_VERSION.tar.gz"
    
    # Clean up downloaded file
    rm "./actions-runner-linux-x64-$RUNNER_VERSION.tar.gz"
    
    print_status "Runner files extracted to $RUNNER_DIR"
}

# Configure runner
configure_runner() {
    print_status "Configuring runner..."
    
    cd "$HOME/actions-runner"
    
    echo ""
    echo "🔧 Runner Configuration"
    echo "======================="
    echo "Repository: https://github.com/amir-0x00/wa_baileys_erp"
    echo ""
    echo "You need to get a runner token from:"
    echo "https://github.com/amir-0x00/wa_baileys_erp/settings/actions/runners/new"
    echo ""
    echo "Or use a personal access token with 'repo' scope"
    echo ""
    
    read -p "Enter your GitHub token: " GITHUB_TOKEN
    
    if [ -z "$GITHUB_TOKEN" ]; then
        print_error "Token is required"
        exit 1
    fi
    
    # Configure the runner
    ./config.sh --url https://github.com/amir-0x00/wa_baileys_erp --token "$GITHUB_TOKEN" --unattended
    
    print_status "Runner configured successfully"
}

# Install runner as service
install_service() {
    print_status "Installing runner as service..."
    
    cd "$HOME/actions-runner"
    
    # Install as service
    sudo ./svc.sh install
    
    print_status "Runner service installed"
    
    # Start the service
    sudo ./svc.sh start
    
    print_status "Runner service started"
}

# Create application directories
create_directories() {
    print_status "Creating application directories..."
    
    sudo mkdir -p /opt/wa-baileys-erp
    sudo chown $USER:$USER /opt/wa-baileys-erp
    
    mkdir -p /opt/wa-baileys-erp/uploads
    mkdir -p /opt/wa-baileys-erp/auth_info_baileys
    
    print_status "Application directories created"
}

# Main execution
main() {
    echo "Starting setup process..."
    echo ""
    
    check_dependencies
    install_nodejs
    install_pm2
    setup_runner
    configure_runner
    install_service
    create_directories
    
    echo ""
    echo "🎉 Setup completed successfully!"
    echo "================================"
    echo ""
    echo "📋 Summary:"
    echo "• GitHub Actions runner installed at: $HOME/actions-runner"
    echo "• Runner service is running"
    echo "• Application directory: /opt/wa-baileys-erp"
    echo "• Node.js and PM2 installed"
    echo ""
    echo "🔗 Next steps:"
    echo "1. Push code to trigger workflows"
    echo "2. Check runner status at: https://github.com/amir-0x00/wa_baileys_erp/settings/actions/runners"
    echo "3. Monitor workflows at: https://github.com/amir-0x00/wa_baileys_erp/actions"
    echo ""
    echo "📊 Useful commands:"
    echo "• Check runner status: sudo $HOME/actions-runner/svc.sh status"
    echo "• Stop runner: sudo $HOME/actions-runner/svc.sh stop"
    echo "• Start runner: sudo $HOME/actions-runner/svc.sh start"
    echo "• View logs: tail -f $HOME/actions-runner/_diag/*.log"
    echo ""
}

# Run main function
main "$@" 