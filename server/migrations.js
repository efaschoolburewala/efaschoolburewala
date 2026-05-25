const pool = require('./db');

async function runEssentialMigrations() {
    const client = await pool.connect();
    try {
        console.log("🚀 Running essential database migrations...");
        await client.query('BEGIN');

        // 1. Academic Terms Migration
        console.log("   → Checking academic_terms columns...");
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='academic_terms' AND column_name='has_summer_work') THEN
                    ALTER TABLE academic_terms ADD COLUMN has_summer_work BOOLEAN DEFAULT FALSE;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='academic_terms' AND column_name='has_winter_work') THEN
                    ALTER TABLE academic_terms ADD COLUMN has_winter_work BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
        `);

        // 2. Fee Plans Migration
        console.log("   → Checking fee_plans columns...");
        await client.query(`
            ALTER TABLE fee_plans ADD COLUMN IF NOT EXISTS applies_to_all BOOLEAN DEFAULT FALSE;
        `);

        // 3. Print Tracking Migration
        console.log("   → Checking monthly_fee_slips columns...");
        await client.query(`
            ALTER TABLE monthly_fee_slips 
            ADD COLUMN IF NOT EXISTS is_printed BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS printed_at TIMESTAMP;
        `);

        // 4. Backfill student_siblings for blood siblings
        // Students who share the same family_id AND same father_name are blood siblings.
        // They may not have an explicit row in student_siblings if they were enrolled before
        // the relationship tracking table existed. This query fixes that gap.
        console.log("   → Backfilling student_siblings for blood siblings...");
        await client.query(`
            INSERT INTO student_siblings (student_id, sibling_id, relation_type)
            SELECT 
                a.student_id,
                b.student_id,
                'blood'
            FROM students a
            JOIN students b 
                ON a.family_id = b.family_id
                AND a.student_id != b.student_id
                AND COALESCE(REPLACE(LOWER(TRIM(a.father_name)), ' ', ''), '') != ''
                AND COALESCE(REPLACE(LOWER(TRIM(a.father_name)), ' ', ''), '') 
                    = COALESCE(REPLACE(LOWER(TRIM(b.father_name)), ' ', ''), '')
            WHERE a.family_id IS NOT NULL
            ON CONFLICT (student_id, sibling_id) DO NOTHING
        `);
        console.log("   ✓ Blood sibling backfill complete.");

        await client.query('COMMIT');
        console.log("✅ All essential migrations completed successfully!");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Migration failed:", err.message);
        // We don't exit process here because we want the server to try and start anyway
    } finally {
        client.release();
    }
}

module.exports = { runEssentialMigrations };
