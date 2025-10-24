#!/bin/bash

# AWS EC2 Deployment Script for Country Currency API

echo "🚀 Starting deployment..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql

# Setup MySQL database
sudo mysql -e "CREATE DATABASE IF NOT EXISTS country_api;"
sudo mysql -e "CREATE USER IF NOT EXISTS 'apiuser'@'localhost' IDENTIFIED BY 'secure_password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON country_api.* TO 'apiuser'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# Install PM2 globally
sudo npm install -g pm2

# Setup SSH for GitHub (if not exists)
if [ ! -f ~/.ssh/id_rsa ]; then
  echo "⚠️  SSH key not found. Please add your SSH key to access GitHub:"
  echo "   ssh-keygen -t rsa -b 4096 -C 'your-email@example.com'"
  echo "   cat ~/.ssh/id_rsa.pub  # Add this to GitHub SSH keys"
  echo "   ssh -T git@github.com  # Test connection"
fi

# Create app directory
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www

# Clone repository or pull if exists
cd /var/www
if [ ! -d "country-currency-api" ]; then
  git clone https://github.com/tulbadex/country-currency-api.git
else
  cd country-currency-api
  git pull origin main
  cd ..
fi
cd country-currency-api

# Install dependencies
npm install --production

# Create environment file
cat > .env << EOF
PORT=3000
DB_HOST=localhost
DB_USER=apiuser
DB_PASSWORD=secure_password
DB_NAME=country_api
EOF

# Start application with PM2
pm2 start server.js --name country-api
pm2 startup
pm2 save

# Install and configure Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/country-api > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/country-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Configure firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

echo "✅ Deployment completed!"
echo "🌐 API is now available at: http://your-ec2-ip"
echo "📊 Test with: curl http://your-ec2-ip/status"