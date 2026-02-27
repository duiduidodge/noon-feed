import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function runMigration() {
  try {
    const migrationPath = join(__dirname, '../prisma/migrations/20260215191546_add_all_features/migration.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('Running migration...');

    // Execute as one big transaction
    await prisma.$executeRawUnsafe(sql);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    // Try running essential parts individually if full migration fails
    console.log('\nAttempting to run critical parts individually...');

    try {
      // Backfill search vectors for existing data
      console.log('Backfilling Article search vectors...');
      await prisma.$executeRaw`
        UPDATE "Article" SET search_vector_en =
          setweight(to_tsvector('english', COALESCE("titleOriginal", '')), 'A') ||
          setweight(to_tsvector('english', COALESCE("extractedText", '')), 'B')
        WHERE search_vector_en IS NULL
      `;

      console.log('Backfilling Enrichment search vectors...');
      await prisma.$executeRaw`
        UPDATE "Enrichment" SET search_vector_th =
          setweight(to_tsvector('simple', COALESCE("titleTh", '')), 'A') ||
          setweight(to_tsvector('simple', COALESCE("summaryTh", '')), 'B')
        WHERE search_vector_th IS NULL
      `;

      console.log('✅ Critical parts completed successfully!');
      console.log('⚠️  Note: You may need to create triggers manually using a PostgreSQL client');
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
      throw fallbackError;
    }
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
