import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTriggers() {
  try {
    console.log('Creating full-text search triggers...');

    // Create Article search vector trigger function
    console.log('Creating article_search_vector_update function...');
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION article_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector_en :=
          setweight(to_tsvector('english', COALESCE(NEW."titleOriginal", '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW."extractedText", '')), 'B');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create Article trigger
    console.log('Creating article_search_vector_trigger...');
    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS article_search_vector_trigger ON "Article";
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER article_search_vector_trigger
        BEFORE INSERT OR UPDATE ON "Article"
        FOR EACH ROW EXECUTE FUNCTION article_search_vector_update();
    `);

    // Create Enrichment search vector trigger function
    console.log('Creating enrichment_search_vector_update function...');
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION enrichment_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector_th :=
          setweight(to_tsvector('simple', COALESCE(NEW."titleTh", '')), 'A') ||
          setweight(to_tsvector('simple', COALESCE(NEW."summaryTh", '')), 'B');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create Enrichment trigger
    console.log('Creating enrichment_search_vector_trigger...');
    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS enrichment_search_vector_trigger ON "Enrichment";
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER enrichment_search_vector_trigger
        BEFORE INSERT OR UPDATE ON "Enrichment"
        FOR EACH ROW EXECUTE FUNCTION enrichment_search_vector_update();
    `);

    console.log('✅ All triggers created successfully!');
  } catch (error) {
    console.error('❌ Failed to create triggers:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTriggers();
