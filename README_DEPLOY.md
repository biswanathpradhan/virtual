# Quick Deployment Guide

## Prerequisites Checklist

- [ ] Ubuntu 20.04+ server
- [ ] Domain name configured (optional)
- [ ] SSH access to server
- [ ] Root or sudo access

## Quick Start (5 Minutes)

### 1. Server Setup (One-time)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL
sudo apt install mysql-server -y

# Install Nginx
sudo apt install nginx -y

# Install PM2
sudo npm install -g pm2
```

### 2. Clone and Setup

```bash
cd /var/www
sudo git clone <your-repo-url> Virtual-Office
cd Virtual-Office
sudo chown -R $USER:$USER .
```

### 3. Database Setup

```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE virtual_office;
CREATE USER 'vo_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON virtual_office.* TO 'vo_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Configure Environment

```bash
cp .env.example .env
nano .env
```

Update these values:
- `DB_PASSWORD` - Your database password
- `JWT_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `CLIENT_URL` - Your domain or IP

### 5. Deploy

```bash
chmod +x deploy.sh
./deploy.sh
```

### 6. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/virtual-office
```

Paste the Nginx config from `DEPLOYMENT.md` (Step 6.1)

```bash
sudo ln -s /etc/nginx/sites-available/virtual-office /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. SSL (If you have a domain)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

### 8. Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Verify Deployment

```bash
# Check PM2
pm2 status
pm2 logs

# Check Nginx
sudo systemctl status nginx

# Test
curl http://localhost:5000/api/health
```

## Common Commands

```bash
# View logs
pm2 logs virtual-office

# Restart app
pm2 restart virtual-office

# Stop app
pm2 stop virtual-office

# Update application
git pull
./deploy.sh

# Database backup
mysqldump -u vo_user -p virtual_office > backup.sql
```

## Troubleshooting

**App won't start:**
```bash
pm2 logs virtual-office --lines 100
cd server && node index.js
```

**Port in use:**
```bash
sudo lsof -i :5000
# Change PORT in .env or kill process
```

**Database connection:**
```bash
mysql -u vo_user -p virtual_office
```

**Nginx errors:**
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

## Production Checklist

- [ ] Strong passwords set
- [ ] JWT secret changed
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Backups scheduled
- [ ] Monitoring set up
- [ ] Log rotation configured

For detailed instructions, see `DEPLOYMENT.md`

