const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
require('dotenv').config();

const DEFAULT_BACKUP_DIR = path.join(__dirname, 'backups');

// Pure Node.js Complete PostgreSQL Dump Generator
async function generatePureSqlBackup(filepath) {
    const client = await pool.connect();
    try {
        let schoolName = 'School Management System';
        try {
            const sRes = await client.query("SELECT setting_value FROM school_settings WHERE setting_key = 'school_name' UNION SELECT setting_value FROM system_settings WHERE setting_key = 'school_name'");
            if (sRes.rows.length > 0 && sRes.rows[0].setting_value) {
                schoolName = sRes.rows[0].setting_value;
            }
        } catch (e) {}

        console.log(`[Backup System] Generating full SQL database dump for ${schoolName}...`);
        let sqlDump = `-- ========================================================\n`;
        sqlDump += `-- ${schoolName.toUpperCase()} FULL DATABASE BACKUP\n`;
        sqlDump += `-- Generated At: ${new Date().toISOString()}\n`;
        sqlDump += `-- Engine: PostgreSQL\n`;
        sqlDump += `-- ========================================================\n\n`;
        sqlDump += `SET statement_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nSET session_replication_role = 'replica';\n\n`;

        // 1. Sequences DDL & Values
        const seqsRes = await client.query(`
            SELECT sequence_name 
            FROM information_schema.sequences 
            WHERE sequence_schema = 'public'
            ORDER BY sequence_name;
        `);
        for (const seq of seqsRes.rows) {
            const sName = seq.sequence_name;
            try {
                const valRes = await client.query(`SELECT last_value FROM "${sName}"`);
                if (valRes.rows.length > 0) {
                    sqlDump += `CREATE SEQUENCE IF NOT EXISTS "${sName}";\n`;
                    sqlDump += `SELECT setval('"${sName}"', ${valRes.rows[0].last_value}, true);\n\n`;
                }
            } catch (e) {}
        }

        // 2. Public Tables DDL & Data
        const tablesRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);

        const tables = tablesRes.rows.map(r => r.table_name);

        for (const table of tables) {
            // Get columns for table DDL
            const colsRes = await client.query(`
                SELECT column_name, data_type, column_default, is_nullable, character_maximum_length 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = $1
                ORDER BY ordinal_position;
            `, [table]);

            const colDefs = colsRes.rows.map(col => {
                let typeStr = col.data_type.toUpperCase();
                if (typeStr === 'USER-DEFINED') typeStr = 'VARCHAR(255)';
                if (typeStr === 'ARRAY') typeStr = 'TEXT[]';
                if (col.character_maximum_length) typeStr += `(${col.character_maximum_length})`;
                const nullStr = col.is_nullable === 'NO' ? ' NOT NULL' : '';
                const defaultStr = col.column_default ? ` DEFAULT ${col.column_default}` : '';
                return `"${col.column_name}" ${typeStr}${nullStr}${defaultStr}`;
            }).join(',\n    ');

            sqlDump += `-- ========================================================\n`;
            sqlDump += `-- Table structure & data for: "${table}"\n`;
            sqlDump += `-- ========================================================\n`;
            sqlDump += `CREATE TABLE IF NOT EXISTS "${table}" (\n    ${colDefs}\n);\n\n`;

            const colNames = colsRes.rows.map(c => `"${c.column_name}"`).join(', ');

            // Fetch table data
            const dataRes = await client.query(`SELECT * FROM "${table}"`);
            if (dataRes.rows.length > 0) {
                sqlDump += `-- Data for table: "${table}" (${dataRes.rows.length} rows)\n`;
                for (const row of dataRes.rows) {
                    const values = colsRes.rows.map(col => {
                        const val = row[col.column_name];
                        if (val === null || val === undefined) return 'NULL';
                        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                        if (typeof val === 'number') return val;
                        if (val instanceof Date) return `'${val.toISOString()}'`;
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

        sqlDump += `SET session_replication_role = 'origin';\n`;

        fs.writeFileSync(filepath, sqlDump, 'utf8');
        console.log(`[Backup System] Pure SQL Full Backup created cleanly at ${filepath}`);
        return true;
    } catch (err) {
        console.error('[Backup System] Error generating pure SQL dump:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

// Save Backup Notification State in DB
async function recordBackupNotification(filename, targetLocation, reason = 'Scheduled') {
    try {
        const payload = JSON.stringify({
            filename,
            location: targetLocation,
            timestamp: new Date().toISOString(),
            reason,
            read: false
        });

        await pool.query(`
            INSERT INTO system_settings (setting_key, setting_value, category, description)
            VALUES ('last_backup_info', $1, 'backup', 'Latest database backup metadata & notification')
            ON CONFLICT (setting_key) DO UPDATE SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
        `, [payload]);
    } catch (e) {
        console.warn("Could not save backup notification info:", e.message);
    }
}

// Function to Perform Backup
const performBackup = async (reason = 'Manual Request') => {
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

        let finalPath = defaultFilePath;
        // Copy to custom destination directory if configured
        if (customDir && customDir !== DEFAULT_BACKUP_DIR) {
            const customFilePath = path.join(customDir, filename);
            fs.copyFileSync(defaultFilePath, customFilePath);
            finalPath = customFilePath;
            console.log(`[Backup System] Backup stored at custom location: ${customFilePath}`);
        }

        await recordBackupNotification(filename, finalPath, reason);
        return filename;
    } catch (e) {
        console.error("[Backup System] Pure SQL dump failed, attempting pg_dump fallback...", e.message);
        return new Promise((resolve, reject) => {
            let { DB_USER, DB_PASSWORD, DB_NAME, DB_HOST, DB_PORT, PG_DUMP_PATH } = process.env;
            const pgDumpCommand = PG_DUMP_PATH || 'pg_dump';
            const setEnv = process.platform === 'win32'
                ? `set "PGPASSWORD=${DB_PASSWORD}" &&`
                : `PGPASSWORD="${DB_PASSWORD}"`;
            const cmd = `${setEnv} "${pgDumpCommand}" -U ${DB_USER} -h ${DB_HOST || 'localhost'} -p ${DB_PORT || 5432} -F p -f "${defaultFilePath}" ${DB_NAME}`;

            exec(cmd, async (error) => {
                if (error) {
                    return reject(error);
                }
                let finalPath = defaultFilePath;
                if (customDir && customDir !== DEFAULT_BACKUP_DIR) {
                    try {
                        finalPath = path.join(customDir, filename);
                        fs.copyFileSync(defaultFilePath, finalPath);
                    } catch (errCopy) {}
                }
                await recordBackupNotification(filename, finalPath, reason);
                resolve(filename);
            });
        });
    }
};

// Scheduler Tasks List
let activeTasks = [];

// Catch-Up Backup Check on System Startup (If system was powered off during scheduled time)
async function checkMissedBackupsOnStartup(isEnabled) {
    if (!isEnabled) return;
    try {
        const res = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'last_backup_info'");
        if (res.rows.length > 0 && res.rows[0].setting_value) {
            const info = JSON.parse(res.rows[0].setting_value);
            const lastTime = new Date(info.timestamp).getTime();
            const now = Date.now();
            const hoursDiff = (now - lastTime) / (1000 * 60 * 60);

            // If last backup was over 12 hours ago, run catch-up backup for downtime
            if (hoursDiff > 12) {
                console.log(`[Backup System] Missed scheduled backup detected (Downtime: ${hoursDiff.toFixed(1)} hours). Triggering Recovery Catch-Up Backup...`);
                await performBackup('System Startup Recovery Catch-Up');
            }
        } else {
            // First time auto backup setup
            console.log(`[Backup System] Initial Auto Backup Trigger on System Startup...`);
            await performBackup('Initial System Startup Backup');
        }
    } catch (e) {
        console.warn('[Backup System] Error checking missed backups:', e.message);
    }
}

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

        // Check for missed backups during system downtime
        await checkMissedBackupsOnStartup(isEnabled);

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
                        performBackup(`Scheduled Daily (${t})`).catch(err => console.error('[Backup System] Scheduled backup error:', err));
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
