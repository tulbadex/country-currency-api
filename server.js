const express = require('express');
const mysql = require('mysql2/promise');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs').promises;

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
      const exchangeRate = currencyCode ? rates[currencyCode] || null : null;
      const randomMultiplier = Math.random() * 1000 + 1000;
      const estimatedGdp = exchangeRate ? (country.population * randomMultiplier) / exchangeRate : 0;

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
        country.population,
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
      query += ' ORDER BY estimated_gdp DESC';
    }

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /countries/:name
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

// GET /countries/image
app.get('/countries/image', async (req, res) => {
  try {
    const data = await fs.readFile('./cache/summary.json', 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(404).json({ error: 'Summary image not found' });
  }
});

async function generateSummaryImage() {
  const [countRows] = await db.execute('SELECT COUNT(*) as total FROM countries');
  const [topCountries] = await db.execute('SELECT name, estimated_gdp FROM countries ORDER BY estimated_gdp DESC LIMIT 5');

  const summary = {
    total_countries: countRows[0].total,
    top_countries: topCountries,
    generated_at: new Date().toISOString()
  };

  await fs.mkdir('./cache', { recursive: true });
  await fs.writeFile('./cache/summary.json', JSON.stringify(summary, null, 2));
}

const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

module.exports = app;