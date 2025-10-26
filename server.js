const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs').promises;
const { createCanvas } = require('canvas');
const path = require('path');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'country_api',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database
async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS countries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      capital VARCHAR(255),
      region VARCHAR(255),
      population BIGINT NOT NULL,
      currency_code VARCHAR(10),
      exchange_rate DECIMAL(15,6),
      estimated_gdp DECIMAL(20,2),
      flag_url TEXT,
      last_refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

// POST /countries/refresh
app.post('/countries/refresh', async (req, res) => {
  try {
    const [countriesRes, ratesRes] = await Promise.all([
      axios.get('https://restcountries.com/v2/all?fields=name,capital,region,population,flag,currencies'),
      axios.get('https://open.er-api.com/v6/latest/USD')
    ]);

    const countries = countriesRes.data;
    const rates = ratesRes.data.rates;

    for (const country of countries) {
      const currencyCode = country.currencies?.[0]?.code || null;
      const exchangeRate = currencyCode && rates[currencyCode] ? parseFloat(rates[currencyCode]) : null;
      const randomMultiplier = Math.random() * 1000 + 1000;
      const estimatedGdp = exchangeRate ? (parseInt(country.population) * randomMultiplier) / exchangeRate : 0;

      await db.execute(`
        INSERT INTO countries (name, capital, region, population, currency_code, exchange_rate, estimated_gdp, flag_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        capital = VALUES(capital),
        region = VALUES(region),
        population = VALUES(population),
        currency_code = VALUES(currency_code),
        exchange_rate = VALUES(exchange_rate),
        estimated_gdp = VALUES(estimated_gdp),
        flag_url = VALUES(flag_url),
        last_refreshed_at = CURRENT_TIMESTAMP
      `, [
        country.name,
        country.capital || null,
        country.region || null,
        parseInt(country.population) || 0,
        currencyCode,
        exchangeRate,
        estimatedGdp,
        country.flag || null
      ]);
    }

    await generateSummaryImage();
    res.json({ message: 'Countries refreshed successfully' });
  } catch (error) {
    console.error(error);
    res.status(503).json({
      error: 'External data source unavailable',
      details: `Could not fetch data from ${error.config?.url || 'external API'}`
    });
  }
});

// GET /countries/image (must be before /:name)
app.get('/countries/image', async (req, res) => {
  try {
    await fs.access('./cache/summary.png');
    res.sendFile(path.resolve('./cache/summary.png'));
  } catch (error) {
    res.status(404).json({ error: 'Summary image not found' });
  }
});

// GET /countries
app.get('/countries', async (req, res) => {
  try {
    let query = 'SELECT * FROM countries WHERE 1=1';
    const params = [];

    if (req.query.region) {
      query += ' AND region = ?';
      params.push(req.query.region);
    }
    if (req.query.currency) {
      query += ' AND currency_code = ?';
      params.push(req.query.currency);
    }
    if (req.query.sort === 'gdp_desc') {
      query += ' ORDER BY CAST(estimated_gdp AS DECIMAL(20,2)) DESC';
    }

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /countries/:name (must be last)
app.get('/countries/:name', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM countries WHERE name = ?', [req.params.name]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /countries/:name
app.delete('/countries/:name', async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM countries WHERE name = ?', [req.params.name]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Country not found' });
    }
    res.json({ message: 'Country deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /status
app.get('/status', async (req, res) => {
  try {
    const [countRows] = await db.execute('SELECT COUNT(*) as total FROM countries');
    const [timeRows] = await db.execute('SELECT MAX(last_refreshed_at) as last_refresh FROM countries');
    
    res.json({
      total_countries: countRows[0].total,
      last_refreshed_at: timeRows[0].last_refresh
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});



async function generateSummaryImage() {
  const [countRows] = await db.execute('SELECT COUNT(*) as total FROM countries');
  const [topCountries] = await db.execute('SELECT name, estimated_gdp FROM countries ORDER BY estimated_gdp DESC LIMIT 5');

  // Create canvas
  const canvas = createCanvas(800, 600);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 800, 600);

  // Title
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 28px Arial';
  ctx.fillText('Country Summary Report', 50, 60);

  // Total countries
  ctx.font = '20px Arial';
  ctx.fillText(`Total Countries: ${countRows[0].total}`, 50, 120);

  // Top 5 countries header
  ctx.font = 'bold 22px Arial';
  ctx.fillText('Top 5 Countries by GDP:', 50, 180);

  // Top countries list
  ctx.font = '18px Arial';
  topCountries.forEach((country, index) => {
    const gdp = parseFloat(country.estimated_gdp || 0);
    const gdpFormatted = gdp.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    ctx.fillText(`${index + 1}. ${country.name}`, 70, 220 + index * 40);
    ctx.fillText(`   GDP: ${gdpFormatted}`, 90, 245 + index * 40);
  });

  // Timestamp
  ctx.font = '16px Arial';
  ctx.fillStyle = '#666666';
  ctx.fillText(`Generated: ${new Date().toISOString()}`, 50, 550);

  // Save image
  await fs.mkdir('./cache', { recursive: true });
  const buffer = canvas.toBuffer('image/png');
  await fs.writeFile('./cache/summary.png', buffer);
}

const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

module.exports = app;