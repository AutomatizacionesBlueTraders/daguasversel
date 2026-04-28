require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const useSsl = String(process.env.DATABASE_SSL || 'false').toLowerCase() === 'true';

module.exports = {
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  },
  pool: { min: 0, max: 10 },
  migrations: {
    directory: __dirname + '/migrations',
    tableName: 'knex_migrations',
  },
};
