# Vending Machine Dashboard

Full-stack vending machine management system. Admin dashboard tracks real-time sales data ingested from AWS SQS. Customers submit feedback via QR code links.

**Stack:** HTML / CSS / JavaScript — PHP 8.1+ — MySQL 8.0+ — AWS (EC2, RDS, SQS)

---

## Project Structure

```
435 Project4/
├── api/
│   ├── config/
│   │   ├── Database.php       # PDO singleton
│   │   ├── AwsConfig.php      # AWS credential loader
│   │   └── cors.php           # CORS + JSON response helpers
│   ├── feedback/
│   │   ├── submit.php         # POST  /api/feedback/submit.php
│   │   └── list.php           # GET   /api/feedback/list.php
│   └── sales/
│       ├── summary.php        # GET   /api/sales/summary.php
│       └── weekly.php         # GET   /api/sales/weekly.php?period=weekly|daily|monthly
├── database/
│   └── schema.sql             # Table definitions + seed data
├── public/
│   ├── admin/                 # Admin dashboard (restricted access)
│   │   ├── index.html
│   │   ├── css/dashboard.css
│   │   └── js/dashboard.js
│   └── feedback/              # Customer-facing QR code page
│       ├── index.html
│       ├── css/feedback.css
│       └── js/feedback.js
├── scripts/
│   └── sqs_consumer.php       # CLI: polls SQS, inserts sales rows
├── .env.example
├── .htaccess
├── composer.json
└── README.md
```

---

## AWS Setup — Step by Step

### 1. Create an RDS MySQL Instance

1. Open the [RDS Console](https://console.aws.amazon.com/rds/).
2. Click **Create database** → **Standard create** → **MySQL**.
3. Choose **MySQL 8.0**, Free Tier or your preferred instance class.
4. Set a DB identifier (e.g., `vending-db`), master username, and a strong password.
5. Under **Connectivity**, choose the same VPC as your EC2 instance.
6. Expand **Additional configuration** → set **Initial database name** to `vending_db`.
7. Click **Create database**. Note the **endpoint hostname** once available.

### 2. Launch an EC2 Instance

1. Open the [EC2 Console](https://console.aws.amazon.com/ec2/).
2. Click **Launch Instance** → choose **Amazon Linux 2023** (or Ubuntu 22.04).
3. Instance type: `t3.micro` (free tier eligible).
4. Create or select a key pair. Download the `.pem` file.
5. Under **Network settings**, allow inbound:
   - Port 22 (SSH) — your IP only
   - Port 80 (HTTP) — 0.0.0.0/0
   - Port 443 (HTTPS) — 0.0.0.0/0
6. Launch the instance and note the **Public IPv4 address**.

### 3. Create an SQS Queue

1. Open the [SQS Console](https://console.aws.amazon.com/sqs/).
2. Click **Create queue** → **Standard queue**.
3. Name it `VendingMachineSales`.
4. Leave defaults, click **Create queue**.
5. Copy the **Queue URL** — you'll need it for `.env`.

### 4. Create an IAM User for the Application

1. Open [IAM Console](https://console.aws.amazon.com/iam/) → **Users** → **Add users**.
2. Username: `vending-app`. Select **Programmatic access**.
3. Attach policy: **AmazonSQSFullAccess** (or a custom policy scoped to your queue).
4. Complete creation and **download the CSV** — save the Access Key ID and Secret.

### 5. Configure the EC2 Server

SSH into the instance and run:

```bash
# Amazon Linux 2023
sudo dnf install -y httpd php php-pdo php-mysqlnd php-json unzip git
sudo systemctl enable --now httpd

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

For **Ubuntu 22.04** substitute `apt`:
```bash
sudo apt update && sudo apt install -y apache2 php php-mysql php-json unzip git curl
```

### 6. Deploy the Application

```bash
# Clone or upload your project
cd /var/www/html
sudo git clone <your-repo-url> .
# or: sudo cp -r /path/to/project/* .

# Install PHP dependencies (AWS SDK)
sudo composer install --no-dev --optimize-autoloader

# Copy and fill in environment variables
sudo cp .env.example .env
sudo nano .env
# Fill in DB_HOST, DB_USER, DB_PASS, AWS credentials, SQS_QUEUE_URL

# Fix permissions
sudo chown -R apache:apache /var/www/html    # Amazon Linux
# sudo chown -R www-data:www-data /var/www/html  # Ubuntu

# Enable mod_rewrite
sudo sed -i 's/AllowOverride None/AllowOverride All/' /etc/httpd/conf/httpd.conf
sudo systemctl restart httpd
```

### 7. Import the Database

```bash
mysql -h <RDS_ENDPOINT> -u <MASTER_USER> -p vending_db < /var/www/html/database/schema.sql
```

### 8. Set Up the SQS Cron Job

```bash
sudo crontab -e
```

Add this line (runs every 5 minutes):
```
*/5 * * * * /usr/bin/php /var/www/html/scripts/sqs_consumer.php >> /var/log/vending_sqs.log 2>&1
```

### 9. Access the Application

| Page | URL |
|------|-----|
| Admin Dashboard | `http://<EC2-IP>/public/admin/` |
| Customer Feedback | `http://<EC2-IP>/public/feedback/?machine=VM001&location=Building+A+-+Lobby` |

Generate QR codes for each machine using the feedback URL pattern:
```
http://<your-domain>/public/feedback/?machine=VM001&location=Building+A+-+Lobby
```

---

## Local Development

Requirements: PHP 8.1+, MySQL 8.0+, a web server (Apache or `php -S`).

```bash
# 1. Import database
mysql -u root -p < database/schema.sql

# 2. Configure environment
cp .env.example .env
# Edit .env with your local DB credentials

# 3. Install dependencies
composer install

# 4. Start PHP dev server (from project root)
php -S localhost:8000

# 5. Visit
#   Admin:    http://localhost:8000/public/admin/
#   Feedback: http://localhost:8000/public/feedback/?machine=VM001&location=Building+A+-+Lobby
```

> The frontend falls back to realistic mock data when the API is unreachable, so the dashboard works even without a running PHP server.

---

## Sending a Test SQS Message

With the AWS CLI configured:
```bash
aws sqs send-message \
  --queue-url "https://sqs.us-east-1.amazonaws.com/<account-id>/VendingMachineSales" \
  --message-body '{
    "machine_id": "VM001",
    "product_sku": "BEV-001",
    "quantity": 1,
    "amount": 1.75,
    "timestamp": "2026-04-17T10:30:00Z"
  }'
```

Then trigger the consumer manually or wait for the cron:
```bash
php scripts/sqs_consumer.php
```
