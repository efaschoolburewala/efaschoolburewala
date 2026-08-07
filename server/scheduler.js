const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
require('dotenv').config();

const DEFAULT_BACKUP_DIR = path.join(__dirname, 'backups');

// Pure Node.js PostgreSQL Dump Generator
async function generatePureSqlBackup(filepath) {
    const client = await pool.connect();
    try {
        console.log(`[Backup System] Generating pure SQL database dump...`);
        let sqlDump = `-- ========================================================\n`;
        sqlDump += `-- SHAHEEN ENGLISH MODEL SCHOOL VEHARI DATABASE BACKUP\n`;
        sqlDump += `-- Generated At: ${new Date().toISOString()}\n`;
        sqlDump += `-- ========================================================\n\n`;
        sqlDump += `SET statement_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\n\n`;

        // Get all public tables
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);

        const tables = tablesRes.rows.map(r => r.table_name);

        for (const table of tables) {
            // Get columns for table
            const colsRes = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY ordinal_position;
            `, [table]);

            const colNames = colsRes.rows.map(c => `"${c.column_name}"`).join(', ');

            // Fetch table data
            const dataRes = await client.query(`SELECT * FROM "${table}"`);
            if (dataRes.rows.length > 0) {
                sqlDump += `-- Data for table: ${table} (${dataRes.rows.length} rows)\n`;
                for (const row of dataRes.rows) {
                    const values = colsRes.rows.map(col => {
                        const val = row[col.column_name];
                        if (val === null || val === undefined) return 'NULL';
                        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                        if (typeof val === 'number') return val;
                        if (Array.isArray(val)) {
                            const arrStr = val.map(v => typeof v === 'string' ? `"${v.replace(/"/g, '\\"')}"` : v).join(',');
                            return `'${`{${arrStr}}`}'`;
                        }
                        if (typeof val === 'object') {
                            return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                        }
                        return `'${String(val).replace(/'/g, "''")}'`;
                    }).join(', ');

                    sqlDump += `INSERT INTO "${table}" (${colNames}) VALUES (${values}) ON CONFLICT DO NOTHING;\n`;
                }
                sqlDump += `\n`;
            }
        }

        fs.writeFileSync(filepath, sqlDump, 'utf8');
        console.log(`[Backup System] Pure SQL Backup created cleanly at ${filepath}`);
        return true;
    } catch (err) {
        console.error('[Backup System] Error generating pure SQL dump:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// Function to Perform Backup
const performBackup = async () => {
    let backupDir = DEFAULT_BACKUP_DIR;
    let customDir = null;

    try {
        const res = await pool.query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('backup_path')");
        const pathRow = res.rows.find(r => r.setting_key === 'backup_path');
        if (pathRow && pathRow.setting_value && pathRow.setting_value.trim() !== '') {
            customDir = pathRow.setting_value.trim();
        }
    } catch (err) {
        console.warn("Failed to read backup_path setting, using default.");
    }

    // Ensure default backup dir exists
    if (!fs.existsSync(DEFAULT_BACKUP_DIR)) {
        fs.mkdirSync(DEFAULT_BACKUP_DIR, { recursive: true });
    }

    // Ensure custom dir exists if configured
    if (customDir && !fs.existsSync(customDir)) {
        try {
            fs.mkdirSync(customDir, { recursive: true });
        } catch (e) {
            console.error("Could not create custom backup dir, saving to default.", e);
            customDir = null;
        }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;
    const defaultFilePath = path.join(DEFAULT_BACKUP_DIR, filename);

    try {
        // Generate pure SQL dump
        await generatePureSqlBackup(defaultFilePath);

        // Copy to custom destination directory if configured
        if (customDir && customDir !== DEFAULT_BACKUP_DIR) {
            const customFilePath = path.join(customDir, filename);
            fs.copyFileSync(defaultFilePath, customFilePath);
            console.log(`[Backup System] Backup also stored at destination path: ${customFilePath}`);
        }

        return filename;
    } catch (e) {
        console.error("[Backup System] Pure SQL dump failed, attempting pg_dump fallback...", e.message);
        // Fallback to pg_dump if needed
        return new Promise((resolve, reject) => {
            let { DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT, PG_DUMP_PATH } = process.env;
            const pgDumpCommand = PG_DUMP_PATH || 'pg_dump';
            const setEnv = process.platform === 'win32'
                ? `set "PGPASSWORD=${DB_PASSWORD}" &&`
                : `PGPASSWORD="${DB_PASSWORD}"`;
            const cmd = `${setEnv} "${pgDumpCommand}" -U ${DB_USER} -h ${DB_HOST || 'localhost'} -p ${DB_PORT || 5432} -F p -f "${defaultFilePath}" ${DB_NAME}`;

            exec(cmd, (error) => {
                if (error) {
                    return reject(error);
                }
                if (customDir && customDir !== DEFAULT_BACKUP_DIR) {
                    try {
                        fs.copyFileSync(defaultFilePath, path.join(customDir, filename));
                    } catch (errCopy) {}
                }
                resolve(filename);
            });
        });
    }
};

// Scheduler Tasks List
let activeTasks = [];

// Initialize Scheduler (Configured for 2 Times Daily Backup)
const initScheduler = async () => {
    try {
        console.log('[Backup System] Initializing Backup Scheduler...');

        // Stop existing tasks
        activeTasks.forEach(task => task.stop());
        activeTasks = [];

        // 1. Get Settings from DB
        const res = await pool.query("SELECT * FROM system_settings WHERE category = 'backup' OR setting_key LIKE '%backup%'");
        const settings = {};
        res.rows.forEach(r => settings[r.setting_key] = r.setting_value);

        const isEnabled = settings['auto_backup_enabled'] === 'true';
        if (!isEnabled) {
            console.log('[Backup System] Auto backup is DISABLED in settings.');
            return;
        }

        // Configure 2 Daily Backup Times (Default: 08:00 AM & 08:00 PM)
        const time1 = settings['backup_time_1'] || settings['backup_time'] || '08:00';
        const time2 = settings['backup_time_2'] || '20:00';

        const times = [time1, time2].filter(Boolean);

        times.forEach(t => {
            const parts = t.split(':');
            if (parts.length === 2) {
                const hour = parseInt(parts[0], 10);
                const minute = parseInt(parts[1], 10);
                if (!isNaN(hour) && !isNaN(minute)) {
                    const cronExp = `${minute} ${hour} * * *`;
                    console.log(`[Backup System] Scheduled 2-Time Daily Job set for: ${cronExp} (${t})`);
                    const task = cron.schedule(cronExp, () => {
                        console.log(`[Backup System] Triggering scheduled backup for ${t}...`);
                        performBackup().catch(err => console.error('[Backup System] Scheduled backup error:', err));
                    });
                    activeTasks.push(task);
                }
            }
        });

    } catch (err) {
        console.error('[Backup System] Error initializing backup scheduler:', err.message);
    }
};

module.exports = { initScheduler, performBackup };
