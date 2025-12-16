# Hostinger Shared Hosting - Quick Start Guide

This is a condensed guide for deploying Virtual Office on Hostinger shared hosting.

## Prerequisites Checklist

- [ ] Hostinger account with Node.js support enabled
- [ ] cPanel access
- [ ] Domain name configured
- [ ] FTP client or File Manager access

## Quick Deployment Steps

### 1. Build Locally (5 minutes)

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Create production environment file
# Create client/.env.production with:
# REACT_APP_API_URL=https://yourdomain.com/api
# REACT_APP_SOCKET_URL=https://yourdomain.com

# Build React app
cd client
npm run build
cd ..
```

### 2. Create Database in cPanel (2 minutes)

1. **cPanel** → **MySQL Databases**
2. Create database: `yourusername_virtualoffice`
3. Create user: `yourusername_dbuser`
4. Add user to database with **ALL PRIVILEGES**
5. Note down: DB name, user, password, host (usually `localhost`)

### 3. Initialize Database (2 minutes)

**Option A: Via phpMyAdmin (Recommended)**
1. **cPanel** → **phpMyAdmin**
2. Select your database
3. **SQL** tab → Paste contents of `hostinger-setup.sql`
4. Click **Go**

**Option B: Via Node.js Script**
- Upload `hostinger-setup.js` to server
- Run via Node.js console in cPanel (if available)

### 4. Upload Files via FTP (10 minutes)

Upload this structure to `public_html`:

```
public_html/
├── server/          (entire server folder)
├── client/build/    (contents of build folder)
├── .env            (create with your config)
├── package.json
└── package-lock.json
```

**Create `.env` file:**
```env
NODE_ENV=production
PORT=3000
CLIENT_URL=https://yourdomain.com
DB_HOST=localhost
DB_USER=your_hostinger_db_user
DB_PASSWORD=your_hostinger_db_password
DB_NAME=your_hostinger_db_name
JWT_SECRET=your_generated_secret_here
```

### 5. Create Node.js App in cPanel (5 minutes)

1. **cPanel** → **Node.js** or **Node.js App**
2. Click **Create Application**
3. Configure:
   - **Node.js Version**: 18.x or 20.x
   - **Application Root**: `public_html`
   - **Application Startup File**: `server/index.js`
   - **Application Mode**: Production
4. Click **Create**
5. Click **Install Dependencies**

### 6. Set Environment Variables (3 minutes)

In Node.js App Manager:
1. Find your app → Click **Edit**
2. Go to **Environment Variables**
3. Add all variables from your `.env` file
4. Save

### 7. Set Permissions (2 minutes)

Using File Manager:
1. Navigate to `server/uploads`
2. Create folders: `profiles/` and `rooms/`
3. Set permissions to **755** or **775**

### 8. Start Application (1 minute)

1. **Node.js App Manager** → Find your app
2. Click **Start** or **Restart**
3. Check status - should show "Running"

### 9. Enable SSL (2 minutes)

1. **cPanel** → **SSL/TLS Status**
2. Select your domain
3. Click **Run AutoSSL** or install Let's Encrypt
4. Enable **Force HTTPS Redirect**

### 10. Test (5 minutes)

Visit `https://yourdomain.com` and test:
- [ ] Registration
- [ ] Login
- [ ] Room creation
- [ ] Audio/Video calls

## Common Issues & Quick Fixes

### ❌ App won't start
- Check Node.js version (use 18.x)
- Verify port matches Hostinger's assigned port
- Check logs in Node.js App Manager

### ❌ Database connection error
- Verify credentials in `.env`
- Check database user has ALL PRIVILEGES
- Confirm host is `localhost`

### ❌ Static files not loading
- Verify `client/build` contents uploaded correctly
- Check file permissions (644 for files, 755 for folders)

### ❌ Socket.IO not working
- Verify `CLIENT_URL` in environment variables
- Socket.IO will auto-fallback to polling on shared hosting

## File Structure Reference

```
public_html/
├── server/
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── socket/
│   ├── uploads/
│   │   ├── profiles/    (755 permissions)
│   │   └── rooms/       (755 permissions)
│   ├── index.js
│   └── package.json
├── client/
│   └── build/          (React production build)
├── .env                (Environment variables)
├── package.json
└── package-lock.json
```

## Environment Variables Checklist

Make sure these are set in Node.js App Manager:

- [ ] `NODE_ENV=production`
- [ ] `PORT=3000` (or Hostinger assigned port)
- [ ] `CLIENT_URL=https://yourdomain.com`
- [ ] `DB_HOST=localhost`
- [ ] `DB_USER=your_db_user`
- [ ] `DB_PASSWORD=your_db_password`
- [ ] `DB_NAME=your_db_name`
- [ ] `JWT_SECRET=your_secret_key`

## Update Process

When updating your app:

1. **Build locally**: `cd client && npm run build`
2. **Upload new files** via FTP
3. **Restart app** in Node.js App Manager

## Need Help?

- Check full guide: `DEPLOYMENT.md` (Hostinger section)
- Check application logs in Node.js App Manager
- Check error logs in cPanel
- Verify database in phpMyAdmin

## Estimated Total Time: ~30 minutes

---

**Pro Tip**: Keep a backup of your `.env` file and database credentials in a secure location!

