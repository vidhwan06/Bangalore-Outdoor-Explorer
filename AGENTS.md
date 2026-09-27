# AGENTS.md — Engineering Instructions for Bengaluru Outdoor Explorer

This file contains persistent engineering instructions for AI agents working on this repository.
Follow these rules strictly. Do not deviate without explicit approval.

---

## 1. PROJECT CONTEXT

**Product:** Bengaluru Outdoor Explorer — The living outdoor map of Bengaluru
**Core Promise:** Everything you need before you leave
**Geography:** Bengaluru + ~150km radius (designed for Karnataka/South India expansion)
**Architecture:** Modular monolith — Next.js (App Router) + TypeScript + PostgreSQL/PostGIS

**Key Principles:**

- Trusted, current, useful outdoor information
- Never invent: routes, permits, opening info, safety-critical info, private-property access
- Community data = observations, not permanent truth
- AI explains retrieved data, never fabricates facts
- Location privacy for sensitive destinations

---

## 2. ARCHITECTURAL BOUNDARIES

```
Presentation (app/, components/)
    ↓
Application Services (lib/, features/*/services.ts)
    ↓
Domain Logic (features/*/domain.ts)
    ↓
Data Access (lib/db/, features/*/repositories.ts)
    ↓
PostgreSQL/PostGIS
```

**External integrations isolated behind services:**

- `MapService` → `MapProvider` (Mapbox/Google/MapLibre)
- `WeatherService` → `WeatherProvider` (OpenWeather/WeatherAPI)
- `StorageService` → `StorageProvider` (Local/S3/Cloudinary)
- `RoutingService` → `RoutingProvider` (OSRM/Valhalla/Mapbox)
- `AuthService` → `AuthProvider` (NextAuth/Clerk/Supabase)

**NEVER:**

- Put business logic in React components
- Scatter DB queries in UI
- Scatter third-party API calls in components
- Use AI as a database
- Hard-code category logic in UI

---

## 3. DATABASE RULES

**PostgreSQL + PostGIS mandatory.**

- Use `geography(Point, 4326)` for location points
- Use `geometry(LineString, 4326)` for trail routes
- Create GiST indexes on spatial columns
- Never store lat/lng only as strings/JSON

**Schema Philosophy:**

- `places` = stable destination facts
- Time-bound observations → separate tables (`conditions`, `weather_snapshots`, `crowd_reports`, `hazard_reports`)
- Verification metadata → `verification_records`
- Community submissions → `community_submissions` (never auto-apply)

**Enums (defined in Prisma + Postgres):**

- `PlaceCategory`: TREK, HIKE, WATERFALL, LAKE, MOUNTAIN, FOREST, CAVE, FORT, VIEWPOINT, CAMPING, CYCLING, SCENIC_DRIVE, HIDDEN_GEM
- `PlaceStatus`: OPEN, PERMIT_REQUIRED, LIMITED_SLOTS, CLOSED, WEATHER_CONCERN, UNVERIFIED
- `VisibilityLevel`: PUBLIC_EXACT, PUBLIC_APPROXIMATE, VERIFIED_COMMUNITY_ONLY, MODERATOR_ONLY, PRIVATE
- `TrustLevel`: VERIFIED, COMMUNITY_SUBMITTED, INFORMATION_OUTDATED, CLOSED_RESTRICTED, UNDER_REVIEW
- `UserRole`: USER, CONTRIBUTOR, MODERATOR, ADMIN

---

## 4. DEVELOPMENT WORKFLOW

**Before changing code:**

1. Inspect repository — understand what exists
2. Identify conflicts with architecture
3. Report conflicts
4. Propose smallest reasonable change
5. Implement incrementally
6. Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
7. Report exactly what changed

**Commands:**

```bash
pnpm dev          # Development server
pnpm build        # Production build
pnpm typecheck    # TypeScript check
pnpm lint         # ESLint
pnpm test         # Jest tests
pnpm test:watch   # Watch mode
pnpm format       # Prettier
pnpm db:generate  # Prisma generate
pnpm db:push      # Push schema (dev)
pnpm db:migrate   # Create migration
pnpm db:studio    # Prisma Studio
pnpm db:seed      # Seed database
```

---

## 5. CODE STANDARDS

**TypeScript:**

- Strict mode enabled
- No `any` — use `unknown` or proper types
- Zod schemas for all boundaries (API, forms, AI tools)
- Domain types in `types/` or feature folders

**React/Next.js:**

- Server Components by default
- Client Components only when needed (`'use client'`)
- Colocate components with features
- Use `@/` path aliases

**Styling:**

- Tailwind CSS only
- Design tokens in `tailwind.config.ts`
- `cn()` utility for class merging
- No inline styles except dynamic values

**Validation:**

- Zod schemas in `lib/validation/schemas.ts`
- Validate at API boundaries
- Validate AI tool inputs/outputs

**Error Handling:**

- Custom error classes in `lib/security/index.ts`
- `handleApiError()` for API routes
- Never leak stack traces to client

---

## 6. AI ARCHITECTURE RULES

**AI Flow:**

```
User Request
    ↓
Constraint Extraction (hard constraints: status, permits, time, safety)
    ↓
Database/External Retrieval (via structured tools)
    ↓
Candidate Generation
    ↓
Deterministic Ranking (distance, weather, conditions, trust, preferences)
    ↓
AI Explanation + Itinerary Composition
```

**AI MUST:**

- Call tools for all factual data
- Respect hard constraints (closed, permit required, safety)
- Explain recommendations citing retrieved data
- Mark uncertainty when data is stale/unverified

**AI MUST NEVER:**

- Invent routes, coordinates, permits, opening hours
- Fabricate safety information
- Override verified official sources with community data
- Access database directly (only via tools)

**Tool Interface:** Defined in `ai/tools/index.ts`

- All tools have Zod input/output schemas
- Tools are pure functions (no side effects beyond reading)
- Implementations in `ai/tools/implementations/`

---

## 7. SECURITY RULES

- Server-side authorization always (never client-only)
- Role hierarchy: USER < CONTRIBUTOR < MODERATOR < ADMIN
- Rate limiting on all public endpoints
- Input validation with Zod at every boundary
- CSRF protection for mutations
- Secure headers via middleware
- No secrets in client code
- Audit logging for admin actions
- Location privacy: respect `VisibilityLevel`

---

## 8. TESTING STRATEGY

**Unit Tests:** Domain logic, validation, ranking, distance calculations, trust calculations
**Integration Tests:** Database queries, API routes, auth, PostGIS queries
**E2E Tests:** Search, map discovery, place page, save, visit, submission, admin verification, itinerary generation

**AI Tests (future):**

- Tool calling correctness
- No fabrication of unsupported claims
- Constraint respect
- Safety data from trusted sources

---

## 9. MVP PHASES (Current: Phase 0)

**Phase 0 — Foundation (CURRENT)**

- Repository, Next.js, TypeScript, Tailwind
- Environment management, linting, formatting, testing
- Error handling, logging, AGENTS.md
- Prisma schema + PostGIS migrations for core tables

**Phase 1 — Data Foundation**

- PostgreSQL/PostGIS setup
- Places, categories, official sources, verification foundation
- Initial seed data

**Phase 2 — Discovery**

- Homepage, map, markers, search, filters
- Destination cards, detail page

**Phase 3 — Practical Info**

- Routes, entry/permits, weather, conditions
- Nearby food, fuel, facilities, safety

**Phase 4 — Users**

- Auth, profiles, saved/visited places, exploration map

**Phase 5 — Community**

- Posts, trail reports, hidden gems, verification, moderation

**Phase 6 — AI**

- Tool interfaces, retrieval, deterministic ranking
- Itinerary generation, AI explanations

**Phase 7+ — Advanced**

---

## 10. IMPORTANT FILES

| File                        | Purpose                             |
| --------------------------- | ----------------------------------- |
| `prisma/schema.prisma`      | Database schema (source of truth)   |
| `prisma/migrations/`        | SQL migrations (PostGIS enabled)    |
| `lib/db/prisma.ts`          | Prisma client singleton             |
| `lib/validation/schemas.ts` | All Zod validation schemas          |
| `lib/auth/index.ts`         | Auth abstraction + permissions      |
| `lib/maps/index.ts`         | Maps abstraction                    |
| `lib/weather/index.ts`      | Weather abstraction                 |
| `lib/storage/index.ts`      | Storage abstraction                 |
| `lib/routing/index.ts`      | Routing abstraction                 |
| `lib/security/index.ts`     | Rate limiting, sanitization, errors |
| `lib/utils.ts`              | Shared utilities                    |
| `ai/tools/index.ts`         | AI tool definitions (Zod schemas)   |
| `ai/tools/implementations/` | Tool implementations                |
| `features/places/`          | Place domain logic                  |
| `features/trails/`          | Trail domain logic                  |
| `features/conditions/`      | Conditions domain logic             |
| `app/`                      | Next.js App Router pages            |
| `components/ui/`            | Reusable UI components              |
| `tests/`                    | Unit, integration, E2E tests        |

---

## 11. COMMON PATTERNS

**Service Pattern (in `features/*/services.ts`):**

```typescript
// features/places/services.ts
export const placeService = {
  async search(filters: PlaceFilterInput): Promise<Paginated<Place>> { ... }
  async getById(id: string): Promise<PlaceDetail | null> { ... }
  async create(data: PlaceCreateInput, userId: string): Promise<Place> { ... }
}
```

**Repository Pattern (in `features/*/repositories.ts`):**

```typescript
// features/places/repositories.ts
export const placeRepository = {
  async findMany(filters: PlaceFilterInput): Promise<Place[]> { ... }
  async findById(id: string): Promise<Place | null> { ... }
  async create(data: PlaceCreateInput): Promise<Place> { ... }
}
```

**API Route Pattern:**

```typescript
// app/api/places/route.ts
export async function GET(request: NextRequest) {
  try {
    const params = await validateRequest(request, placeFilterSchema);
    const result = await placeService.search(params);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

## 12. ENVIRONMENT VARIABLES

Required (see `.env.example`):

- `DATABASE_URL` — PostgreSQL with PostGIS
- `AUTH_SECRET` — 32+ char secret
- `NEXT_PUBLIC_MAP_PROVIDER` — mapbox|google|maplibre
- `MAPBOX_ACCESS_TOKEN` / `GOOGLE_MAPS_API_KEY`
- `WEATHER_PROVIDER` — openweather|weatherapi
- `OPENWEATHER_API_KEY` / `WEATHERAPI_KEY`
- `STORAGE_PROVIDER` — local|s3|cloudinary
- `AI_PROVIDER` — openai|anthropic
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`

---

## 13. GIT WORKFLOW

- Main branch: `main`
- Feature branches: `feat/description`
- Fix branches: `fix/description`
- Commits: Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`)
- PR required for all changes
- CI must pass: typecheck, lint, test, build

---

## 14. DECISION LOG

| Date       | Decision                             | Rationale                                        |
| ---------- | ------------------------------------ | ------------------------------------------------ |
| 2026-09-27 | Modular monolith with Next.js        | Simplicity, deployment on Vercel, colocation     |
| 2026-09-27 | Prisma + raw SQL for PostGIS         | Type safety for most queries, raw for spatial    |
| 2026-09-27 | Zod for all validation               | Type-safe boundaries, AI tool contracts          |
| 2026-09-27 | Abstraction layers for all externals | Provider swap without app changes                |
| 2026-09-27 | AI tools with Zod schemas            | Structured, verifiable, testable AI interactions |

---

## 15. WHEN IN DOUBT

1. Check this file first
2. Check existing code patterns in `features/`, `lib/`, `app/`
3. Prefer smaller, testable modules
4. Validate at boundaries
5. Keep providers replaceable
6. Document architectural decisions
7. Ask for clarification on large changes

---

**Last Updated:** 2026-09-27 (Project initialization)
**Next Review:** After Phase 0 completion
