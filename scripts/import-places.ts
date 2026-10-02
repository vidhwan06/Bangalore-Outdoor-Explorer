// Place Import Script
// Reads a JSON dataset and imports places using the service layer.
// Usage: pnpm tsx scripts/import-places.ts
//        pnpm tsx scripts/import-places.ts --file data/places.json
//        pnpm tsx scripts/import-places.ts --user-id <uuid>

import './load-env';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '@/lib/db/prisma';
import { placeService } from '@/features/places/services';
import { placeCreateSchema, type PlaceCreateInput } from '@/lib/validation/schemas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env or the environment');
}

type ImportAction = 'CREATED' | 'UPDATED' | 'SKIPPED';

interface ImportResult {
  name: string;
  slug: string;
  action: ImportAction;
  success: boolean;
  error?: string;
}

interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  results: ImportResult[];
}

function parseArgs(): { file: string; userId?: string } {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith('--file='));
  const userIdArg = args.find((a) => a.startsWith('--user-id='));

  const file = fileArg ? fileArg.split('=')[1] : resolve(__dirname, '../data/places.json');
  const userId = userIdArg ? userIdArg.split('=')[1] : undefined;

  return { file, userId };
}

function validateRecord(record: unknown): { success: true; data: PlaceCreateInput } | { success: false; error: string } {
  const parsed = placeCreateSchema.safeParse(record);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { success: false, error: `Validation failed: ${issues}` };
  }
  return { success: true, data: parsed.data };
}

async function importPlaces(filePath: string, userId?: string): Promise<ImportSummary> {
  console.log(`📥 Reading dataset from: ${filePath}`);

  let raw: unknown;
  try {
    const content = readFileSync(filePath, 'utf-8');
    raw = JSON.parse(content);
  } catch (e) {
    throw new Error(`Failed to read/parse JSON file: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!Array.isArray(raw)) {
    throw new Error('Dataset must be a JSON array of place objects');
  }

  console.log(`📋 Found ${raw.length} records to process`);

  const results: ImportResult[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, record] of raw.entries()) {
    const name = (record as Record<string, unknown>).name as string ?? `record-${index}`;
    console.log(`\n[${index + 1}/${raw.length}] Processing: ${name}`);

    // Validate
    const validation = validateRecord(record);
    if (!validation.success) {
      console.log(`  ❌ Validation failed: ${validation.error}`);
      results.push({ name, slug: '', action: 'SKIPPED', success: false, error: validation.error });
      failed++;
      continue;
    }

    const data = validation.data;

    // Determine the slug that would be used (explicit or generated)
    const { slugify } = await import('@/lib/utils');
    const expectedSlug = data.slug ?? slugify(data.name);

    // Check if place already exists with this slug
    const existing = await prisma.place.findUnique({ where: { slug: expectedSlug } });

    if (existing) {
      // Compare if data is identical to decide SKIPPED vs UPDATED
      // For simplicity, we'll do a full upsert and check if anything changed
      try {
        const result = await placeService.upsertPlace(data, undefined);
        if (result.created) {
          console.log(`  ✅ Created: ${result.place.name} (slug: ${result.place.slug})`);
          results.push({ name: result.place.name, slug: result.place.slug, action: 'CREATED', success: true });
          created++;
        } else {
          console.log(`  🔄 Updated: ${result.place.name} (slug: ${result.place.slug})`);
          results.push({ name: result.place.name, slug: result.place.slug, action: 'UPDATED', success: true });
          updated++;
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.log(`  ❌ Import failed: ${errorMsg}`);
        results.push({ name: data.name, slug: expectedSlug, action: 'SKIPPED', success: false, error: errorMsg });
        failed++;
      }
    } else {
      // New place - create it
      try {
        const result = await placeService.upsertPlace(data, undefined);
        console.log(`  ✅ Created: ${result.place.name} (slug: ${result.place.slug})`);
        results.push({ name: result.place.name, slug: result.place.slug, action: 'CREATED', success: true });
        created++;
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.log(`  ❌ Import failed: ${errorMsg}`);
        results.push({ name: data.name, slug: expectedSlug, action: 'SKIPPED', success: false, error: errorMsg });
        failed++;
      }
    }
  }

  console.log('\n📊 Import Summary:');
  console.log(`  Total:     ${results.length}`);
  console.log(`  Created:   ${created}`);
  console.log(`  Updated:   ${updated}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Failed:    ${failed}`);

  return { total: results.length, created, updated, skipped, failed, results };
}

async function main() {
  const { file, userId } = parseArgs();

  if (userId) {
    console.log(`👤 Using creator user ID: ${userId}`);
  }

  try {
    const summary = await importPlaces(file, userId);

    if (summary.failed > 0) {
      console.log('\n⚠️  Some records failed. Details:');
      for (const r of summary.results) {
        if (!r.success) {
          console.log(`  - ${r.name}: ${r.error}`);
        }
      }
      process.exit(1);
    } else {
      console.log('\n🎉 All records imported successfully!');
      process.exit(0);
    }
  } catch (e) {
    console.error('❌ Fatal error:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();