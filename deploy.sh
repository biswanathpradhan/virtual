#!/bin/bash

# Virtual Office Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 Starting Virtual Office Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please do not run as root${NC}"
   exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js 18+ is required. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js version check passed${NC}"

# Install/Update dependencies
echo -e "${YELLOW}Installing server dependencies...${NC}"
cd server
npm install --production
cd ..

echo -e "${YELLOW}Installing client dependencies...${NC}"
cd client
npm install
cd ..

# Build React app
echo -e "${YELLOW}Building React application...${NC}"
cd client
npm run build
cd ..

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ .env file not found. Creating from template...${NC}"
    cp .env.example .env 2>/dev/null || echo "Please create .env file manually"
fi

# Create logs directory
mkdir -p logs

# Create uploads directory
mkdir -p server/uploads
mkdir -p server/uploads/avatars
mkdir -p server/uploads/room-backgrounds

# Set permissions
chmod -R 755 .
chmod -R 775 server/uploads

# Restart PM2
if command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Restarting PM2...${NC}"
    pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js
    pm2 save
    echo -e "${GREEN}✓ PM2 restarted${NC}"
else
    echo -e "${YELLOW}PM2 not found. Install with: npm install -g pm2${NC}"
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify .env configuration"
echo "2. Check PM2 status: pm2 status"
echo "3. Check logs: pm2 logs virtual-office"
echo "4. Test the application"

