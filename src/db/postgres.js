const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'tax_declaration',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
});

let isConnected = false;
pool.on('connect', () => {
    if (!isConnected) {
        console.log('✅ Connected to PostgreSQL');
        isConnected = true;
    }
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL error:', err);
    process.exit(-1);
});

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>}
 */
const query = async (text, params) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
};

/**
 * Get a client from the pool
 * @returns {Promise<Object>}
 */
const getClient = async () => {
    return await pool.connect();
};

module.exports = {
    pool,
    query,
    getClient,
};
