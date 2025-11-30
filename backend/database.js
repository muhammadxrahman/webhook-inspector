const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    console.log("Initializing database tables...");

    // users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        username VARCHAR(100) UNIQUE,
        auth_provider VARCHAR(50) DEFAULT 'local',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("Users table ready");

    // endpoints table
    await client.query(`
      CREATE TABLE IF NOT EXISTS endpoints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        endpoint_code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      );
    `);
    console.log("Endpoints table ready");

    // validation rules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS validation_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint_id UUID REFERENCES endpoints(id) ON DELETE CASCADE,
        rule_type VARCHAR(50) NOT NULL,
        field_name VARCHAR(200) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("Validation rules table ready");

    // saved webhooks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint_id UUID REFERENCES endpoints(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        headers JSONB,
        body JSONB,
        timestamp TIMESTAMPTZ NOT NULL,
        passed_validation BOOLEAN DEFAULT true,
        validation_errors TEXT,
        saved_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("Saved webhooks table ready");

    // Migrations for existing tables
    await client.query(`
      ALTER TABLE saved_webhooks
      ADD COLUMN IF NOT EXISTS passed_validation BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS validation_errors TEXT;
    `);

    await client.query(`
    ALTER TABLE endpoints
    ADD COLUMN IF NOT EXISTS name VARCHAR(200);
    `);

    // Migrate existing TIMESTAMP columns to TIMESTAMPTZ
    await client.query(`
      DO $$ 
      BEGIN
        -- Users table
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name = 'created_at' 
          AND data_type = 'timestamp without time zone'
        ) THEN
          ALTER TABLE users 
          ALTER COLUMN created_at TYPE TIMESTAMPTZ 
          USING created_at AT TIME ZONE 'UTC';
        END IF;

        -- Endpoints table
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'endpoints' 
          AND column_name = 'created_at' 
          AND data_type = 'timestamp without time zone'
        ) THEN
          ALTER TABLE endpoints 
          ALTER COLUMN created_at TYPE TIMESTAMPTZ 
          USING created_at AT TIME ZONE 'UTC';
        END IF;

        -- Validation rules table
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'validation_rules' 
          AND column_name = 'created_at' 
          AND data_type = 'timestamp without time zone'
        ) THEN
          ALTER TABLE validation_rules 
          ALTER COLUMN created_at TYPE TIMESTAMPTZ 
          USING created_at AT TIME ZONE 'UTC';
        END IF;

        -- Saved webhooks timestamp
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'saved_webhooks' 
          AND column_name = 'timestamp' 
          AND data_type = 'timestamp without time zone'
        ) THEN
          ALTER TABLE saved_webhooks 
          ALTER COLUMN timestamp TYPE TIMESTAMPTZ 
          USING timestamp AT TIME ZONE 'UTC';
        END IF;

        -- Saved webhooks saved_at
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'saved_webhooks' 
          AND column_name = 'saved_at' 
          AND data_type = 'timestamp without time zone'
        ) THEN
          ALTER TABLE saved_webhooks 
          ALTER COLUMN saved_at TYPE TIMESTAMPTZ 
          USING saved_at AT TIME ZONE 'UTC';
        END IF;
      END $$;
    `);

    console.log("Database migrations complete");
    console.log("Database initialization complete");
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
