// Loads environment variables from the repository `.env` file for CLI scripts.
//
// This MUST be imported before any module that constructs a `PrismaClient`
// (e.g. `@/lib/db/prisma`), because Prisma resolves `DATABASE_URL` when the
// client is instantiated.
//
// `override: true` is deliberate: a stray *persistent* DATABASE_URL in the OS
// environment silently shadows `.env` in most loaders (Next.js included), which
// previously caused the app to try to connect to an unrelated host. For an
// ingestion/verification script the project `.env` must win, so imports are
// deterministic. See the note in `.env.example`.

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env'), override: true });
