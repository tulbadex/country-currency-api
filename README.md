# Country Currency & Exchange API

A RESTful API that fetches country data from external APIs, stores it in MySQL, and provides CRUD operations with currency exchange rates.

## 🚀 Features

- Fetch country data from RestCountries API
- Get real-time exchange rates from ExchangeRate API
- Calculate estimated GDP for each country
- Generate summary images with top countries
- Full CRUD operations with filtering and sorting
- MySQL database with caching
- AWS EC2 deployment with CI/CD

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MySQL
- **Image Generation**: Canvas
- **Deployment**: AWS EC2 + PM2 + Nginx
- **CI/CD**: GitHub Actions

## 📋 Prerequisites

- Node.js 18+
- MySQL 8.0+
- Git

## 🔧 Local Setup

1. **Clone repository:**
   ```bash
   git clone <your-repo-url>
   cd country-currency-api
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup MySQL database:**
   ```sql
   CREATE DATABASE country_api;
   CREATE USER 'apiuser'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON country_api.* TO 'apiuser'@'localhost';
   FLUSH PRIVILEGES;
   ```

4. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

## 🌐 API Endpoints

### Core Operations
- `POST /countries/refresh` - Fetch and cache all countries
- `GET /countries` - Get all countries (with filters)
- `GET /countries/:name` - Get specific country
- `DELETE /countries/:name` - Delete country
- `GET /status` - Show total countries and last refresh
- `GET /countries/image` - Serve summary image

### Query Parameters
- `?region=Africa` - Filter by region
- `?currency=NGN` - Filter by currency code
- `?sort=gdp_desc` - Sort by GDP descending

## 📊 Sample Responses

### GET /countries?region=Africa
```json
[
  {
    "id": 1,
    "name": "Nigeria",
    "capital": "Abuja",
    "region": "Africa",
    "population": 206139589,
    "currency_code": "NGN",
    "exchange_rate": 1600.23,
    "estimated_gdp": 25767448125.2,
    "flag_url": "https://flagcdn.com/ng.svg",
    "last_refreshed_at": "2025-01-22T18:00:00Z"
  }
]
```

### GET /status
```json
{
  "total_countries": 250,
  "last_refreshed_at": "2025-01-22T18:00:00Z"
}
```

## 🚀 AWS EC2 Deployment

### Quick Deploy
```bash
chmod +x deploy.sh
./deploy.sh
```

### Manual Deployment Steps

1. **Launch EC2 Instance:**
   - Ubuntu 22.04 LTS
   - t3.micro or larger
   - Security Group: HTTP (80), HTTPS (443), SSH (22)

2. **SSH and run deployment:**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   wget https://raw.githubusercontent.com/tulbadex/country-currency-api/main/deploy.sh
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Update repository URL in deploy.sh before running**

### CI/CD Setup

1. **Add GitHub Secrets:**
   - `EC2_HOST`: Your EC2 public IP
   - `EC2_USERNAME`: ubuntu
   - `EC2_SSH_KEY`: Your private SSH key content

2. **Push to main branch triggers auto-deployment**

## 🧪 Testing

### Test Endpoints
```bash
# Health check
curl http://your-domain/status

# Refresh data
curl -X POST http://your-domain/countries/refresh

# Get countries
curl http://your-domain/countries?region=Africa

# Get specific country
curl http://your-domain/countries/Nigeria

# Get summary image
curl http://your-domain/countries/image
```

### Run Tests
```bash
npm test
```

## 🔧 Environment Variables

```env
PORT=3000
DB_HOST=localhost
DB_USER=apiuser
DB_PASSWORD=your_password
DB_NAME=country_api
```

## 📁 Project Structure

```
country-currency-api/
├── server.js              # Main application
├── package.json           # Dependencies
├── deploy.sh              # AWS deployment script
├── .env.example           # Environment template
├── .github/workflows/     # CI/CD configuration
├── cache/                 # Generated images
└── README.md              # Documentation
```

## 🔍 Error Handling

- `400` - Validation failed
- `404` - Country not found
- `500` - Internal server error
- `503` - External data source unavailable

## 🛡️ Security Features

- Input validation
- SQL injection protection
- CORS enabled
- Environment-based configuration

## 📈 Performance

- Connection pooling for MySQL
- Efficient batch operations
- Image caching
- PM2 process management

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License