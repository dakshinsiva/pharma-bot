# Deployment Guide

This guide covers deploying the Pharmacy Calling Agent to production environments.

---

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database schema finalized
- [ ] All API credentials tested
- [ ] Public domain/URL available
- [ ] SSL certificate ready (for HTTPS)
- [ ] Webhook URLs configured
- [ ] Error monitoring set up
- [ ] Logging configured
- [ ] Backup strategy defined

---

## Deployment Options

### Option 1: AWS (Amazon Web Services)

#### Architecture
```
Internet → ALB → EC2 → RDS PostgreSQL
                               S3 (audio files)
```

#### Steps

1. **Create EC2 Instance**
   ```bash
   # Amazon Linux 2 or Ubuntu 20.04
   # Instance type: t3.medium or larger
   # Open ports: 80, 443, 3000
   ```

2. **Install Dependencies**
   ```bash
   ssh into EC2
   
   # Update system
   sudo yum update -y  # or apt-get update
   
   # Install Node.js 18
   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
   sudo yum install -y nodejs
   
   # Install PM2
   sudo npm install -g pm2
   
   # Install git
   sudo yum install -y git
   ```

3. **Clone and Setup**
   ```bash
   git clone <your-repo-url>
   cd pharma-bot
   npm install
   
   # Copy environment file
   cp .env.example .env
   nano .env  # Configure production credentials
   
   # Setup database
   npm run db:generate
   npm run db:push
   ```

4. **Start with PM2**
   ```bash
   pm2 start server.js --name pharma-bot
   pm2 save
   pm2 startup  # Follow instructions
   ```

5. **Setup Nginx Reverse Proxy**
   ```bash
   sudo yum install -y nginx
   sudo nano /etc/nginx/conf.d/pharma-bot.conf
   ```
   
   Add:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
       
       location /media-stream {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```
   
   ```bash
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```

6. **Setup SSL with Certbot**
   ```bash
   sudo yum install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

7. **Setup RDS PostgreSQL** (Optional)
   - Create RDS PostgreSQL instance
   - Update DATABASE_URL in .env
   - Migrate database: `npm run db:migrate`

---

### Option 2: Google Cloud Platform

#### Architecture
```
Internet → Load Balancer → Cloud Run → Cloud SQL
                                                         Cloud Storage
```

#### Steps

1. **Build Docker Image**
   
   Create `Dockerfile`:
   ```dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   
   COPY package*.json ./
   RUN npm ci --only=production
   
   COPY . .
   
   RUN npx prisma generate
   
   EXPOSE 3000
   
   CMD ["npm", "start"]
   ```
   
   Create `.dockerignore`:
   ```
   node_modules
   .env
   .git
   *.log
   ```

2. **Deploy to Cloud Run**
   ```bash
   # Install gcloud CLI
   # https://cloud.google.com/sdk/docs/install
   
   # Authenticate
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   
   # Build and push
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/pharma-bot
   
   # Deploy
   gcloud run deploy pharma-bot \
     --image gcr.io/YOUR_PROJECT_ID/pharma-bot \
     --platform managed \
     --region asia-south1 \
     --allow-unauthenticated \
     --set-env-vars="NODE_ENV=production" \
     --memory 2Gi \
     --timeout 300s
   ```

3. **Setup Cloud SQL**
   ```bash
   # Create PostgreSQL instance
   gcloud sql instances create pharma-db \
     --database-version=POSTGRES_14 \
     --tier=db-f1-micro \
     --region=asia-south1
   
   # Create database
   gcloud sql databases create pharma_prod \
     --instance=pharma-db
   
   # Connect Cloud Run to Cloud SQL
   # Add connection string to environment variables
   ```

4. **Configure Environment Variables**
   ```bash
   gcloud run services update pharma-bot \
     --update-env-vars="DATABASE_URL=postgresql://...,OPENAI_API_KEY=...,..."
   ```

---

### Option 3: Heroku (Easiest)

#### Steps

1. **Install Heroku CLI**
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku
   
   # Or download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login and Create App**
   ```bash
   heroku login
   heroku create pharma-calling-agent
   ```

3. **Add PostgreSQL**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

4. **Configure Environment**
   ```bash
   heroku config:set OPENAI_API_KEY=sk-xxx
   heroku config:set TWILIO_ACCOUNT_SID=ACxxx
   heroku config:set TWILIO_AUTH_TOKEN=xxx
   heroku config:set TWILIO_PHONE_NUMBER=+1xxx
   heroku config:set BASE_URL=https://your-app.herokuapp.com
   heroku config:set ACTIVE_TELEPHONY_PROVIDER=twilio
   ```

5. **Add Google Credentials**
   ```bash
   # Encode credentials
   cat google-credentials.json | base64 > google-creds-base64.txt
   heroku config:set GOOGLE_CREDENTIALS_BASE64="$(cat google-creds-base64.txt)"
   ```
   
   Update code to decode:
   ```javascript
   // In server.js
   if (process.env.GOOGLE_CREDENTIALS_BASE64) {
     const creds = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString();
     require('fs').writeFileSync('./google-credentials.json', creds);
     process.env.GOOGLE_APPLICATION_CREDENTIALS = './google-credentials.json';
   }
   ```

6. **Deploy**
   ```bash
   git add .
   git commit -m "Deploy to Heroku"
   git push heroku main
   
   # Run migrations
   heroku run npm run db:push
   
   # Check logs
   heroku logs --tail
   ```

---

### Option 4: DigitalOcean

#### Steps

1. **Create Droplet**
   - Ubuntu 22.04 LTS
   - 2GB RAM / 1 vCPU
   - Enable backups

2. **Initial Setup**
   ```bash
   ssh root@your-droplet-ip
   
   # Create user
   adduser pharma
   usermod -aG sudo pharma
   su - pharma
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2
   sudo npm install -g pm2
   ```

3. **Deploy Application**
   ```bash
   cd ~
   git clone <your-repo>
   cd pharma-bot
   npm install
   
   # Configure .env
   nano .env
   
   # Setup database
   npm run db:generate
   npm run db:push
   
   # Start with PM2
   pm2 start server.js
   pm2 startup
   pm2 save
   ```

4. **Setup Nginx**
   ```bash
   sudo apt install -y nginx
   sudo nano /etc/nginx/sites-available/pharma-bot
   ```
   
   Add same Nginx config as AWS section
   
   ```bash
   sudo ln -s /etc/nginx/sites-available/pharma-bot /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

5. **Setup SSL**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

6. **Setup Managed Database** (Optional)
   - Create managed PostgreSQL in DigitalOcean
   - Update DATABASE_URL

---

## Production Security

### 1. Environment Variables
```bash
# Never commit .env
echo ".env" >> .gitignore

# Use secrets management
# AWS: Secrets Manager
# GCP: Secret Manager
# Heroku: Config Vars
```

### 2. Rate Limiting
Add to `app.js`:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 3. API Authentication
Add API key middleware:
```javascript
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey === process.env.API_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

app.use('/api/', authenticateApiKey);
```

### 4. CORS Configuration
```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
```

---

## Monitoring & Logging

### 1. PM2 Monitoring
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# View logs
pm2 logs pharma-bot
```

### 2. Error Tracking with Sentry
```bash
npm install @sentry/node
```

Add to `server.js`:
```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

app.use(Sentry.Handlers.errorHandler());
```

### 3. Application Monitoring
- **New Relic**: Full APM
- **Datadog**: Infrastructure + APM
- **CloudWatch** (AWS): Native monitoring

---

## CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Deploy to Server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /home/pharma/pharma-bot
          git pull origin main
          npm install
          npm run db:generate
          pm2 restart pharma-bot
```

---

## Health Checks

### 1. Uptime Monitoring
Use services like:
- UptimeRobot
- Pingdom
- StatusCake

Check endpoint: `https://your-domain.com/health`

### 2. Custom Health Check Script
```bash
#!/bin/bash
# health-check.sh

response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)

if [ $response -eq 200 ]; then
    echo "Service is healthy"
    exit 0
else
    echo "Service is unhealthy, restarting..."
    pm2 restart pharma-bot
    exit 1
fi
```

Add to crontab:
```bash
*/5 * * * * /home/pharma/health-check.sh >> /var/log/health-check.log 2>&1
```

---

## Backup Strategy

### 1. Database Backups
```bash
# Automated daily backup
0 2 * * * pg_dump $DATABASE_URL > /backups/pharma-db-$(date +\%Y\%m\%d).sql
```

### 2. Application Backups
```bash
# Backup configuration and uploads
0 3 * * * tar -czf /backups/pharma-app-$(date +\%Y\%m\%d).tar.gz /home/pharma/pharma-bot
```

---

## Performance Optimization

### 1. Enable Gzip Compression
```javascript
const compression = require('compression');
app.use(compression());
```

### 2. Use Redis for Caching
```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// Cache LLM sessions
```

### 3. Database Connection Pooling
```javascript
// In prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  pool_timeout = 10
  connection_limit = 20
}
```

---

## Scaling

### Horizontal Scaling
- Deploy multiple instances behind load balancer
- Use Redis for shared session state
- Use message queue (RabbitMQ/SQS) for call queue

### Vertical Scaling
- Increase server resources (CPU/RAM)
- Optimize database queries
- Use CDN for audio files

---

## Post-Deployment Checklist

- [ ] All services running
- [ ] Webhooks receiving callbacks
- [ ] Database accessible
- [ ] Logs being collected
- [ ] Monitoring alerts configured
- [ ] SSL certificate valid
- [ ] Test calls successful
- [ ] Backups running
- [ ] Documentation updated

---

**Your system is now production-ready! **






