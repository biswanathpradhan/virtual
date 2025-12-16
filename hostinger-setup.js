/**
 * Hostinger Database Setup Script
 * 
 * This script can be run via Node.js console in Hostinger cPanel
 * or via SSH if available.
 * 
 * Usage:
 * 1. Make sure .env file is configured with database credentials
 * 2. Run: node hostinger-setup.js
 */

require('dotenv').config();
const initDatabase = require('./server/config/initDatabase');

console.log('Starting database setup for Hostinger...');
console.log('Database:', process.env.DB_NAME || 'virtual_office');
console.log('Host:', process.env.DB_HOST || 'localhost');

initDatabase()
  .then(() => {
    console.log('\n✅ Database setup completed successfully!');
    console.log('You can now start your Node.js application.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Database setup failed!');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check your .env file has correct database credentials');
    console.error('2. Verify database exists in cPanel MySQL Databases');
    console.error('3. Verify database user has ALL PRIVILEGES');
    console.error('4. Check database host (usually "localhost")');
    console.error('\nAlternatively, you can run hostinger-setup.sql in phpMyAdmin');
    process.exit(1);
  });

