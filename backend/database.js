const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const initDB = async () => {
    const client = await pool.connect();
    try {
        console.log('Initializing database tables...');

        // users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                username VARCHAR(100) UNIQUE,
                auth_provider VARCHAR(50) DEFAULT 'local',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('Users table ready');


        // endpoints table
        await client.query(`
            CREATE TABLE IF NOT EXISTS endpoints (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                endpoint_code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(200),
                created_at TIMESTAMP DEFAULT NOW(),
                is_active BOOLEAN DEFAULT true
            );
        `);
        console.log('Endpoints table ready');


        // validation rules table
        await client.query(`
            CREATE TABLE IF NOT EXISTS validation_rules (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                endpoint_id UUID REFERENCES endpoints(id) ON DELETE CASCADE,
                rule_type VARCHAR(50) NOT NULL,
                field_name VARCHAR(200) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('Validation rules table ready');


        // saved webhooks table
        await client.query(`
            CREATE TABLE IF NOT EXISTS saved_webhooks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                endpoint_id UUID REFERENCES endpoints(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                headers JSONB,
                body JSONB,
                timestamp TIMESTAMP NOT NULL,
                passed_validation BOOLEAN DEFAULT true,
                validation_errors TEXT,
                saved_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log('Saved webhooks table ready');

        // For preexisting webhooks
        await client.query(`
            ALTER TABLE saved_webhooks
            ADD COLUMN IF NOT EXISTS passed_validation BOOLEAN DEFAULT true,
            ADD COLUMN IF NOT EXISTS validation_errors TEXT;
        `);

        console.log('DB migrations complete')

        console.log('Database initialization complete');
    } catch (error) {
        console.error('Database initialization error: ', error);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = { pool, initDB };