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

        // 4. School Settings logo_url Migration (allow storing Base64 image data in DB)
        console.log("   → Checking school_settings logo_url column type...");
        await client.query(`
            ALTER TABLE school_settings ALTER COLUMN logo_url TYPE TEXT;
        `);

        // 5. Student Academic Records (Promotion History Table)
        console.log("   → Checking student_academic_records table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_academic_records (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
                academic_year_id INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
                class_id INTEGER NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
                section_id INTEGER NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
                roll_no VARCHAR(50),
                total_marks NUMERIC(10,2) DEFAULT 0,
                obtained_marks NUMERIC(10,2) DEFAULT 0,
                percentage NUMERIC(5,2) DEFAULT 0,
                grade VARCHAR(10),
                rank_in_class INTEGER,
                status VARCHAR(20) DEFAULT 'active',
                promotion_target_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
                promotion_target_class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
                promoted_to_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
                promoted_to_class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
                promoted_on DATE,
                promoted_at TIMESTAMP,
                promoted_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
                attendance_percentage NUMERIC(5,2),
                remarks TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, academic_year_id)
            );

            ALTER TABLE student_academic_records 
            ADD COLUMN IF NOT EXISTS promotion_target_year_id INTEGER REFERENCES academic_years(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS promotion_target_class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS promoted_by_user_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL;
        `);

        // 5. IMPORTANT: We do NOT use father_name to infer relation_type.
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

        // 5. REPAIR: Fix any student_siblings rows incorrectly marked 'blood'
        //    where the two students have DIFFERENT father names.
        //    Blood siblings MUST share the same father different father = cousin or unrelated.
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
