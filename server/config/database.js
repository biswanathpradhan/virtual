const mysql = require('mysql2');
require('dotenv').config();

// Create database if it doesn't exist (promise-based)
const createDatabase = async () => {
  const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  return new Promise((resolve, reject) => {
    connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'virtual_office'}`, (err) => {
      connection.end();
      if (err) {
        console.error('Error creating database:', err);
        reject(err);
      } else {
        console.log('Database ready');
        resolve();
      }
    });
  });
};

// Create pool with promise support
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'virtual_office',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize database
createDatabase().catch(err => {
  console.error('Database initialization error:', err);
});

// Export both promise and callback versions
const promisePool = pool.promise();

// Add getConnection method that works with promises
promisePool.getConnection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        reject(err);
      } else {
        // Wrap connection methods to return promises
        const promiseConnection = {
          ...connection,
          execute: (sql, params) => {
            return new Promise((resolve, reject) => {
              connection.execute(sql, params, (err, results) => {
                if (err) reject(err);
                else resolve(results);
              });
            });
          },
          query: (sql, params) => {
            return new Promise((resolve, reject) => {
              connection.query(sql, params, (err, results) => {
                if (err) reject(err);
                else resolve(results);
              });
            });
          },
          release: () => connection.release()
        };
        resolve(promiseConnection);
      }
    });
  });
};

module.exports = promisePool;

