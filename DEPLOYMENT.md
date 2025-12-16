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

---

# Hostinger Shared Hosting Deployment Guide

This guide covers deploying the Virtual Office application on Hostinger shared hosting. Shared hosting has limitations compared to VPS, but this guide will help you work within those constraints.

## Prerequisites

- Hostinger shared hosting account with Node.js support
- cPanel access
- FTP access (or File Manager)
- Domain name configured in Hostinger
- MySQL database created in Hostinger

## Step 1: Prepare Your Application Locally

### 1.1 Build the React Client

On your local machine, build the production version:

```bash
cd client
npm install
npm run build
```

This creates a `build` folder in the `client` directory.

### 1.2 Prepare Environment Variables

Create a `.env` file for production (you'll upload this later):

```env
# Server Configuration
NODE_ENV=production
PORT=3000
CLIENT_URL=https://yourdomain.com

# Database Configuration
DB_HOST=localhost
DB_USER=your_hostinger_db_user
DB_PASSWORD=your_hostinger_db_password
DB_NAME=your_hostinger_db_name

# JWT Secret Key (Generate a strong random string)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# WebRTC STUN/TURN Servers
STUN_SERVER=stun:stun.l.google.com:19302
TURN_SERVER=
TURN_USERNAME=
TURN_PASSWORD=
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 1.3 Create Client Environment File

Create `client/.env.production`:

```env
REACT_APP_API_URL=https://yourdomain.com/api
REACT_APP_SOCKET_URL=https://yourdomain.com
```

Rebuild the client after creating this file:
```bash
cd client
npm run build
```

## Step 2: Database Setup in Hostinger

### 2.1 Create MySQL Database

1. Log into **cPanel**
2. Go to **MySQL Databases**
3. Create a new database (e.g., `yourusername_virtualoffice`)
4. Create a new MySQL user
5. Add the user to the database with **ALL PRIVILEGES**
6. Note down:
   - Database name: `yourusername_virtualoffice`
   - Database user: `yourusername_dbuser`
   - Database password: (the one you set)
   - Database host: Usually `localhost` (check in cPanel)

### 2.2 Initialize Database Schema

You'll need to run the database initialization. You can do this via:

**Option A: Using phpMyAdmin**
1. Go to **phpMyAdmin** in cPanel
2. Select your database
3. Go to **SQL** tab
4. Run the SQL commands from `server/config/initDatabase.js` (extract the SQL statements)

**Option B: Using Node.js script (after deployment)**
- We'll create a setup script you can run after deploying

## Step 3: Upload Files via FTP

### 3.1 Connect via FTP

Use an FTP client (FileZilla, WinSCP, or cPanel File Manager):
- **Host**: `ftp.yourdomain.com` or IP provided by Hostinger
- **Username**: Your cPanel username
- **Password**: Your cPanel password
- **Port**: 21 (or 22 for SFTP)

### 3.2 Upload Project Files

Upload the following structure to your `public_html` or root directory:

```
public_html/
├── server/
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── socket/
│   ├── uploads/
│   │   ├── profiles/
│   │   └── rooms/
│   ├── index.js
│   └── package.json
├── client/
│   └── build/          (entire build folder contents)
├── .env
├── package.json
└── package-lock.json
```

**Important Notes:**
- Upload `server` folder contents
- Upload `client/build` folder contents directly to `public_html` (or keep in `client/build`)
- Create `server/uploads/profiles` and `server/uploads/rooms` folders with write permissions (755)

## Step 4: Create Node.js App in Hostinger

### 4.1 Access Node.js App Manager

1. Log into **cPanel**
2. Find **Node.js** or **Node.js App** section
3. Click **Create Application**

### 4.2 Configure Node.js Application

Fill in the form:

- **Node.js Version**: Select latest stable (18.x or 20.x)
- **Application Mode**: Production
- **Application Root**: `public_html` (or your chosen directory)
- **Application URL**: Leave default or set to your domain
- **Application Startup File**: `server/index.js`
- **Application Port**: Usually auto-assigned (note this number)
- **Node.js Modules**: Will be installed automatically

### 4.3 Install Dependencies

After creating the app, Hostinger will show you an option to install dependencies. Click **Install Dependencies** or run:

```bash
npm install --production
```

**Note**: If you need to install manually via SSH (if available):
```bash
cd ~/public_html
npm install --production
```

## Step 5: Configure Environment Variables

### 5.1 Set Environment Variables in Node.js App

In the Node.js App Manager in cPanel:

1. Find your application
2. Click **Edit** or **Environment Variables**
3. Add these variables:
   - `NODE_ENV=production`
   - `PORT=3000` (or the port assigned by Hostinger)
   - `CLIENT_URL=https://yourdomain.com`
   - `DB_HOST=localhost`
   - `DB_USER=your_hostinger_db_user`
   - `DB_PASSWORD=your_hostinger_db_password`
   - `DB_NAME=your_hostinger_db_name`
   - `JWT_SECRET=your_generated_jwt_secret`

**Alternative**: If you uploaded a `.env` file, make sure it's in the root directory and Node.js can read it.

## Step 6: Configure Server to Serve Static Files

### 6.1 Update server/index.js

Make sure your `server/index.js` serves static files in production. It should already have this, but verify:

```javascript
// Serve static files from React app (in production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // Serve React app for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}
```

### 6.2 Update File Paths

Since Hostinger may use different directory structures, you might need to adjust paths. Check your actual directory structure and update accordingly.

## Step 7: Create .htaccess for Routing (If Needed)

If your React app routes aren't working, create `.htaccess` in `public_html`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**Note**: This may not be needed if Node.js is handling all routing.

## Step 8: Initialize Database

### 8.1 Create Database Setup Script

Create `setup-db.js` in the root:

```javascript
require('dotenv').config();
const db = require('./server/config/database');
const initDatabase = require('./server/config/initDatabase');

async function setup() {
  try {
    await initDatabase();
    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

setup();
```

### 8.2 Run Database Setup

**Option A: Via Node.js App Manager**
- Some Hostinger panels allow running scripts
- Look for "Run Script" or "Console" option

**Option B: Via SSH (if available)**
```bash
cd ~/public_html
node setup-db.js
```

**Option C: Via phpMyAdmin**
- Manually run SQL statements from `server/config/initDatabase.js`

## Step 9: Set File Permissions

### 9.1 Set Upload Directory Permissions

Using File Manager or FTP:

1. Navigate to `server/uploads`
2. Set permissions:
   - `profiles/` folder: **755** or **775**
   - `rooms/` folder: **755** or **775**

In cPanel File Manager:
- Right-click folder → **Change Permissions**
- Set to **755** (or **775** if 755 doesn't work)

## Step 10: Start/Restart Node.js Application

1. Go to **Node.js App Manager** in cPanel
2. Find your application
3. Click **Restart** or **Start**

The application should now be running!

## Step 11: Configure Domain and SSL

### 11.1 Point Domain to Application

1. In cPanel, go to **Domains** or **Subdomains**
2. Point your domain to the Node.js app directory
3. Or configure the Node.js app URL to match your domain

### 11.2 Enable SSL Certificate

1. Go to **SSL/TLS Status** in cPanel
2. Select your domain
3. Click **Run AutoSSL** or install Let's Encrypt certificate
4. Force HTTPS redirect if available

## Step 12: Verify Deployment

### 12.1 Check Application Status

- Visit `https://yourdomain.com`
- Check Node.js App Manager for status and logs
- Test registration/login
- Test room creation
- Test audio/video calls

### 12.2 Check Logs

In Node.js App Manager, check:
- **Application Logs** - for server errors
- **Error Logs** - for runtime errors

## Troubleshooting for Hostinger

### Application won't start

1. **Check Node.js version**: Ensure compatible version (18.x recommended)
2. **Check port**: Verify the port in environment variables matches Hostinger's assigned port
3. **Check logs**: Review application logs in Node.js App Manager
4. **Check dependencies**: Ensure all npm packages are installed
5. **Check file paths**: Verify all paths are correct for Hostinger's directory structure

### Database connection issues

1. **Verify credentials**: Double-check database name, user, password in cPanel
2. **Check host**: Usually `localhost`, but verify in cPanel MySQL section
3. **Test connection**: Try connecting via phpMyAdmin first
4. **Check user privileges**: Ensure database user has ALL PRIVILEGES

### Static files not loading

1. **Check build folder**: Ensure `client/build` contents are uploaded correctly
2. **Check paths**: Verify paths in `server/index.js` match your directory structure
3. **Check permissions**: Ensure files have read permissions (644)
4. **Check .htaccess**: May need to configure for static file serving

### Socket.IO not working

1. **Check CORS**: Verify `CLIENT_URL` in environment variables
2. **Check port**: Ensure Socket.IO uses the same port as the server
3. **Check firewall**: Some shared hosts block WebSocket connections
4. **Use polling fallback**: Socket.IO should automatically fallback to polling

### Port issues

- Hostinger assigns ports automatically (usually 3000-30000)
- Use the port assigned in Node.js App Manager
- Don't hardcode port 5000 - use environment variable

### File upload issues

1. **Check permissions**: Upload directories need write access (755 or 775)
2. **Check disk space**: Ensure you have enough storage
3. **Check file size limits**: Hostinger may have upload size limits
4. **Check multer config**: Verify multer is configured correctly

## Hostinger-Specific Limitations

1. **No PM2**: Hostinger manages Node.js processes automatically
2. **Limited ports**: Can only use assigned ports
3. **No SSH access**: On basic shared plans (premium may have SSH)
4. **Resource limits**: CPU and memory limits on shared hosting
5. **WebSocket support**: May be limited - Socket.IO will fallback to polling
6. **File system**: Limited access to certain directories

## Alternative: Development Version Setup

If you want to run a development version on Hostinger:

### Option 1: Separate Subdomain

1. Create a subdomain (e.g., `dev.yourdomain.com`)
2. Create a separate Node.js app pointing to a different directory
3. Use development environment variables:
   ```env
   NODE_ENV=development
   PORT=3001
   CLIENT_URL=https://dev.yourdomain.com
   ```

### Option 2: Development Branch

1. Keep development files in a separate folder (e.g., `dev/`)
2. Create a separate Node.js app for development
3. Use different database (e.g., `yourusername_virtualoffice_dev`)

### Option 3: Local Development + Production on Hostinger

- Develop locally using `npm run dev`
- Deploy only production builds to Hostinger
- Use Git to manage versions

## Updates and Maintenance

### Update Application

1. **Build locally**:
   ```bash
   cd client
   npm run build
   ```

2. **Upload changes** via FTP:
   - Upload new `client/build` contents
   - Upload updated `server` files if changed
   - Upload updated `package.json` if dependencies changed

3. **Install dependencies** (if needed):
   - In Node.js App Manager, click "Install Dependencies"

4. **Restart application**:
   - In Node.js App Manager, click "Restart"

### Database Backups

1. Go to **phpMyAdmin** in cPanel
2. Select your database
3. Click **Export**
4. Choose **Quick** or **Custom** method
5. Click **Go** to download backup

Set up automatic backups via cPanel **Backup** feature if available.

## Performance Tips for Shared Hosting

1. **Optimize images**: Compress images before upload
2. **Enable caching**: Configure browser caching headers
3. **Minimize dependencies**: Only install production dependencies
4. **Use CDN**: Consider using a CDN for static assets
5. **Database optimization**: Regularly optimize database tables in phpMyAdmin
6. **Monitor resources**: Check resource usage in cPanel

## Support Resources

- Hostinger Support: Check their knowledge base for Node.js deployment
- Application logs: Node.js App Manager → Application Logs
- Error logs: cPanel → Error Logs
- Database: phpMyAdmin for database issues

---

## Quick Reference Checklist for Hostinger

- [ ] Database created in cPanel MySQL Databases
- [ ] Database user created and granted privileges
- [ ] React app built locally (`npm run build`)
- [ ] Files uploaded via FTP/File Manager
- [ ] Node.js app created in cPanel
- [ ] Environment variables configured
- [ ] Dependencies installed
- [ ] Database initialized (schema created)
- [ ] Upload directories have write permissions (755/775)
- [ ] SSL certificate installed
- [ ] Application restarted
- [ ] Tested registration/login
- [ ] Tested room creation
- [ ] Tested audio/video calls

