# GitHub Actions Setup Guide

This guide explains how to set up GitHub Actions with self-hosted runners for the WhatsApp Baileys ERP project.

## 📋 Overview

The project uses three GitHub Actions workflows:

1. **`test.yml`** - Runs tests and builds on PRs and main branch pushes
2. **`deploy.yml`** - Deploys to production on main branch pushes only
3. **`ci.yml`** - Complete CI/CD pipeline (alternative to the above two)

## 🚀 Quick Setup

### Option 1: Automated Setup (Recommended)

Run the automated setup script:

```bash
./scripts/setup-runner.sh
```

This script will:

- Install Node.js 18
- Install PM2
- Download and configure GitHub Actions runner
- Set up the runner as a service
- Create necessary directories

### Option 2: Manual Setup

Follow these steps manually:

#### 1. Install Dependencies

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
npm install -g pm2

# Other tools
sudo apt-get install -y curl git
```

#### 2. Download GitHub Actions Runner

```bash
# Create runner directory
mkdir -p ~/actions-runner
cd ~/actions-runner

# Download runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz
```

#### 3. Configure Runner

Get a runner token from:

- **Repository**: https://github.com/amir-0x00/wa_baileys_erp/settings/actions/runners/new
- **Or use**: Personal access token with 'repo' scope

```bash
./config.sh --url https://github.com/amir-0x00/wa_baileys_erp --token YOUR_TOKEN
```

#### 4. Install as Service

```bash
# Install service
sudo ./svc.sh install

# Start service
sudo ./svc.sh start
```

#### 5. Create Application Directories

```bash
sudo mkdir -p /opt/wa-baileys-erp
sudo chown $USER:$USER /opt/wa-baileys-erp
mkdir -p /opt/wa-baileys-erp/uploads
mkdir -p /opt/wa-baileys-erp/auth_info_baileys
```

## 🔧 Workflow Details

### Test Workflow (`test.yml`)

**Triggers**: Pull requests and pushes to main branch

**Steps**:

1. Checkout code
2. Setup Node.js 18
3. Install dependencies
4. Run linting (if available)
5. TypeScript type check
6. Run tests (if available)
7. Security audit
8. Build verification
9. Upload build artifacts

### Deploy Workflow (`deploy.yml`)

**Triggers**: Only pushes to main branch

**Steps**:

1. Build application
2. Create deployment directory
3. Backup current deployment
4. Stop current application
5. Copy new files
6. Install production dependencies
7. Create necessary directories
8. Start application
9. Verify deployment
10. Cleanup old backups

### Complete CI/CD (`ci.yml`)

**Triggers**: Pull requests and pushes to main branch

**Jobs**:

1. **test-and-build**: Tests, builds, and security checks
2. **security-scan**: Additional security scanning
3. **deploy**: Deployment (only on main branch pushes)

## 📊 Monitoring

### Check Runner Status

```bash
# Service status
sudo ~/actions-runner/svc.sh status

# Manual check
~/actions-runner/run.sh
```

### View Logs

```bash
# Runner logs
tail -f ~/actions-runner/_diag/*.log

# Application logs
pm2 logs wa-baileys-erp

# PM2 status
pm2 list
```

### GitHub Interface

- **Runners**: https://github.com/amir-0x00/wa_baileys_erp/settings/actions/runners
- **Workflows**: https://github.com/amir-0x00/wa_baileys_erp/actions

## 🔄 Workflow Triggers

| Event        | Workflow                  | Description             |
| ------------ | ------------------------- | ----------------------- |
| Push to main | `test.yml` + `deploy.yml` | Test, build, and deploy |
| Pull Request | `test.yml`                | Test and build only     |
| Push to main | `ci.yml`                  | Complete pipeline       |

## 🛠️ Troubleshooting

### Runner Issues

**Runner not connecting**:

```bash
# Check service status
sudo ~/actions-runner/svc.sh status

# Restart service
sudo ~/actions-runner/svc.sh restart

# Check logs
tail -f ~/actions-runner/_diag/*.log
```

**Token expired**:

1. Go to repository settings
2. Remove old runner
3. Add new runner with fresh token

### Deployment Issues

**Application not starting**:

```bash
# Check PM2 status
pm2 list

# Check logs
pm2 logs wa-baileys-erp

# Restart manually
pm2 restart wa-baileys-erp
```

**Port conflicts**:

```bash
# Check what's using port 3000
sudo lsof -i :3000

# Kill conflicting process
sudo kill -9 PID
```

### Build Issues

**TypeScript errors**:

```bash
# Run build locally
npm run build

# Check for type errors
npx tsc --noEmit
```

**Dependency issues**:

```bash
# Clear cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 🔒 Security Considerations

1. **Runner Security**:

   - Runner runs on your own infrastructure
   - Keep runner updated
   - Monitor runner logs

2. **Token Security**:

   - Use repository-specific tokens
   - Rotate tokens regularly
   - Don't commit tokens to code

3. **Deployment Security**:
   - Application runs in `/opt/wa-baileys-erp`
   - Proper file permissions
   - Automatic backups

## 📈 Performance Optimization

### Runner Optimization

```bash
# Increase runner memory (if needed)
export RUNNER_MEMORY_LIMIT=4G

# Use SSD storage for better performance
# Ensure adequate disk space
```

### Build Optimization

- Uses npm cache for faster installs
- Build artifacts are uploaded for reuse
- Parallel job execution where possible

## 🔄 Maintenance

### Regular Tasks

1. **Update Runner**:

   ```bash
   cd ~/actions-runner
   ./config.sh remove --token YOUR_TOKEN
   # Download new version and reconfigure
   ```

2. **Cleanup Old Artifacts**:

   - GitHub automatically cleans up after 30 days
   - Local backups are cleaned after 7 days

3. **Monitor Disk Space**:
   ```bash
   df -h /opt/wa-baileys-erp
   du -sh ~/actions-runner
   ```

### Backup Strategy

- Application backups: Automatic before each deployment
- Runner configuration: Manual backup of `~/.runner` directory
- PM2 configuration: Backup `/opt/wa-baileys-erp/ecosystem.config.js`

## 📞 Support

For issues with GitHub Actions:

1. Check this documentation
2. Review runner logs
3. Check GitHub Actions documentation
4. Create an issue in the repository

---

**Last updated**: $(date)
