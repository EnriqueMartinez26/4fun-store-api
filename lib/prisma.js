require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

/**
 * Optimización para Vercel (Serverless) + Supabase
 * --------------------------------------------------------------------------
 * Usamos la DIRECT_URL (Puerto 5432) para evitar conflictos entre el 
 * pooler de pg y el pgbouncer de Supabase. El adaptador gestiona el pool
 * de forma local en la función serverless.
 */

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('❌ Error: Ni DATABASE_URL ni DIRECT_URL están definidas.');
}

const pool = new Pool({ 
    connectionString: connectionString,
    max: 2, // Límite estricto para evitar saturar Supabase desde funciones serverless
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
