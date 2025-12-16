# Docker Deployment Guide (Alternative)

For easier deployment, you can use Docker and Docker Compose.

## Prerequisites

- Docker installed
- Docker Compose installed

## Quick Start

### 1. Create docker-compose.yml

```yaml
version: '3.8'

services:
  db:
    image: mysql:8.0
    container_name: virtual-office-db
    restart: always
    environment:
      MYSQL_DATABASE: virtual_office
      MYSQL_USER: vo_user
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
    volumes:
      - db_data:/var/lib/mysql
    ports:
      - "3306:3306"
    networks:
      - virtual-office-network

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: virtual-office-app
    restart: always
    ports:
      - "5000:5000"
    environment:
      NODE_ENV: production
      PORT: 5000
      CLIENT_URL: ${CLIENT_URL}
      DB_HOST: db
      DB_USER: vo_user
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: virtual_office
      JWT_SECRET: ${JWT_SECRET}
    volumes:
      - ./server/uploads:/app/server/uploads
    depends_on:
      - db
    networks:
      - virtual-office-network

  nginx:
    image: nginx:alpine
    container_name: virtual-office-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    networks:
      - virtual-office-network

volumes:
  db_data:

networks:
  virtual-office-network:
    driver: bridge
```

### 2. Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd client && npm install && npm run build

# Copy application files
COPY . .

# Expose port
EXPOSE 5000

# Start application
CMD ["node", "server/index.js"]
```

### 3. Create .env file

```env
DB_PASSWORD=your_strong_password
DB_ROOT_PASSWORD=your_root_password
CLIENT_URL=https://yourdomain.com
JWT_SECRET=your_jwt_secret
```

### 4. Deploy

```bash
docker-compose up -d
```

### 5. View logs

```bash
docker-compose logs -f
```

## Benefits of Docker Deployment

- ✅ Isolated environment
- ✅ Easy to scale
- ✅ Consistent across environments
- ✅ Easy rollback
- ✅ Simplified dependency management

