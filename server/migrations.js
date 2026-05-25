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

        // 4. IMPORTANT: We do NOT use father_name to infer relation_type.
        //    Father name matching is unreliable in Pakistani naming conventions where
        //    cousins often share the same grandfather's name as their father name.
        //
        //    The student_siblings table is the ONLY source of truth for relation_type.
        //    Relationships are explicitly set when:
        //      a) A student is created with siblings (explicit relation_type)
        //      b) Families are manually linked via /families/manual-link
        //      c) Families are merged via /families/merge
        //
        //    Students in the same family with NO entry in student_siblings will have
        //    relation_type = NULL which the frontend shows as "Family Member".
        //    These should be manually linked via the family management UI.

        // 4. REPAIR: Fix any student_siblings rows incorrectly marked 'blood'
        //    where the two students have DIFFERENT father names.
        //    Blood siblings MUST share the same father — different father = cousin or unrelated.
        //    This repair corrects data corrupted by a previous migration that used DO UPDATE.
        //    It is safe to run repeatedly (idempotent).
        console.log("   → Repairing incorrectly marked blood siblings...");
        const repairResult = await client.query(`
            UPDATE student_siblings ss
            SET relation_type = 'cousin'
            FROM students a, students b
            WHERE ss.student_id = a.student_id
              AND ss.sibling_id = b.student_id
              AND ss.relation_type = 'blood'
              AND COALESCE(REPLACE(LOWER(TRIM(a.father_name)), ' ', ''), '') != ''
              AND COALESCE(REPLACE(LOWER(TRIM(b.father_name)), ' ', ''), '') != ''
              AND COALESCE(REPLACE(LOWER(TRIM(a.father_name)), ' ', ''), '') 
                  != COALESCE(REPLACE(LOWER(TRIM(b.father_name)), ' ', ''), '')
        `);
        console.log(`   ✓ Repaired ${repairResult.rowCount} incorrectly marked blood sibling rows.`);

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
