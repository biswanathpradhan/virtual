# Virtual Office - Deployment Guide

This guide will help you deploy the Virtual Office application to a production server.

## Prerequisites

- Ubuntu 20.04+ or similar Linux server
- Node.js 18+ installed
- MySQL/MariaDB installed
- Nginx installed
- Domain name (optional but recommended)
- SSL certificate (Let's Encrypt recommended)

## Step 1: Server Setup

### 1.1 Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Verify installation
```

### 1.3 Install MySQL
```bash
sudo apt install mysql-server -y
sudo mysql_secure_installation
```

### 1.4 Install Nginx
```bash
sudo apt install nginx -y
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 1.5 Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

## Step 2: Clone and Setup Application

### 2.1 Clone Repository
```bash
cd /var/www
sudo git clone <your-repo-url> Virtual-Office
cd Virtual-Office
```

### 2.2 Install Dependencies

**Server dependencies:**
```bash
cd server
npm install --production
```

**Client dependencies:**
```bash
cd ../client
npm install
```

## Step 3: Database Setup

### 3.1 Create Database
```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE virtual_office CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'virtual_office_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';
GRANT ALL PRIVILEGES ON virtual_office.* TO 'virtual_office_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3.2 Configure Environment Variables

Create `.env` file in the root directory:
```bash
cd /var/www/Virtual-Office
sudo nano .env
```

```env
# Server Configuration
NODE_ENV=production
PORT=5000
CLIENT_URL=https://yourdomain.com

# Database Configuration
DB_HOST=localhost
DB_USER=virtual_office_user
DB_PASSWORD=your_strong_password_here
DB_NAME=virtual_office

# JWT Secret Key (Generate a strong random string)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# WebRTC STUN/TURN Servers (Optional)
STUN_SERVER=stun:stun.l.google.com:19302
TURN_SERVER=
TURN_USERNAME=
TURN_PASSWORD=
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Step 4: Build React Application

### 4.1 Build for Production
```bash
cd client
npm run build
```

This creates an optimized production build in the `client/build` directory.

### 4.2 Update Server to Serve Static Files

The server already serves static files from `client/build` when in production mode.

## Step 5: Configure PM2

### 5.1 Create PM2 Ecosystem File

Create `ecosystem.config.js` in the root directory:
```bash
cd /var/www/Virtual-Office
sudo nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'virtual-office',
    script: './server/index.js',
    instances: 2, // Use 2 instances for load balancing
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
```

### 5.2 Create Logs Directory
```bash
mkdir -p logs
```

### 5.3 Start Application with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the instructions to enable PM2 on system startup
```

## Step 6: Configure Nginx

### 6.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/virtual-office
```

```nginx
# Upstream for Node.js server
upstream nodejs_backend {
    least_conn;
    server localhost:5000;
    keepalive 64;
}

# HTTP Server - Redirect to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Client Max Body Size (for file uploads)
    client_max_body_size 50M;
    
    # Root directory
    root /var/www/Virtual-Office/client/build;
    index index.html;
    
    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API Proxy
    location /api {
        proxy_pass http://nodejs_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Socket.IO Proxy
    location /socket.io {
        proxy_pass http://nodejs_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
    
    # Uploads directory
    location /uploads {
        alias /var/www/Virtual-Office/server/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
```

### 6.2 Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/virtual-office /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

## Step 7: SSL Certificate (Let's Encrypt)

### 7.1 Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 7.2 Obtain SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts. Certbot will automatically configure Nginx.

### 7.3 Auto-renewal
Certbot sets up auto-renewal automatically. Test it:
```bash
sudo certbot renew --dry-run
```

## Step 8: Firewall Configuration

### 8.1 Configure UFW
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

## Step 9: File Permissions

### 9.1 Set Proper Permissions
```bash
cd /var/www/Virtual-Office
sudo chown -R www-data:www-data .
sudo chmod -R 755 .
sudo chmod -R 775 server/uploads  # Uploads directory needs write access
```

## Step 10: Environment Variables for Client

Create `.env.production` in the `client` directory:
```bash
cd /var/www/Virtual-Office/client
sudo nano .env.production
```

```env
REACT_APP_API_URL=https://yourdomain.com/api
REACT_APP_SOCKET_URL=https://yourdomain.com
```

Rebuild the client:
```bash
npm run build
```

## Step 11: Verify Deployment

### 11.1 Check PM2 Status
```bash
pm2 status
pm2 logs virtual-office
```

### 11.2 Check Nginx Status
```bash
sudo systemctl status nginx
```

### 11.3 Test Application
- Visit `https://yourdomain.com`
- Test registration/login
- Test room creation
- Test audio/video calls

## Step 12: Monitoring and Maintenance

### 12.1 PM2 Monitoring
```bash
pm2 monit  # Real-time monitoring
pm2 logs   # View logs
```

### 12.2 Set Up Log Rotation
```bash
sudo pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 12.3 Database Backups
Create a backup script:
```bash
sudo nano /usr/local/bin/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/virtual-office"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
mysqldump -u virtual_office_user -p'your_password' virtual_office > $BACKUP_DIR/backup_$DATE.sql
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

Make it executable:
```bash
sudo chmod +x /usr/local/bin/backup-db.sh
```

Add to crontab (daily at 2 AM):
```bash
sudo crontab -e
# Add this line:
0 2 * * * /usr/local/bin/backup-db.sh
```

## Troubleshooting

### Application won't start
```bash
pm2 logs virtual-office --lines 100
cd /var/www/Virtual-Office/server
node index.js  # Run directly to see errors
```

### Database connection issues
```bash
sudo mysql -u virtual_office_user -p
# Test connection
```

### Nginx errors
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Port already in use
```bash
sudo lsof -i :5000
# Kill the process or change PORT in .env
```

## Security Checklist

- [ ] Strong JWT secret configured
- [ ] Database user has limited privileges
- [ ] Firewall configured (UFW)
- [ ] SSL certificate installed
- [ ] HTTPS redirect enabled
- [ ] File upload size limits set
- [ ] Environment variables secured
- [ ] Regular backups configured
- [ ] PM2 auto-restart enabled
- [ ] Log rotation configured

## Performance Optimization

1. **Enable Gzip** (already in Nginx config)
2. **CDN for static assets** (optional)
3. **Redis for session storage** (optional)
4. **Database indexing** (check slow queries)
5. **Image optimization** (compress uploaded images)

## Updates and Maintenance

### Update Application
```bash
cd /var/www/Virtual-Office
git pull origin main
cd client && npm install && npm run build
cd ../server && npm install --production
pm2 restart virtual-office
```

### Update Dependencies
```bash
cd /var/www/Virtual-Office
npm audit
npm audit fix
```

## Support

For issues or questions, check:
- Application logs: `pm2 logs`
- Nginx logs: `/var/log/nginx/`
- System logs: `journalctl -u nginx`

