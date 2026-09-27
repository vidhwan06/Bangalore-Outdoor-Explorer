// Prisma Seed File - Phase 0
// DEVELOPMENT / DEMO DATA ONLY
// This data is for development and demonstration purposes.
// It is NOT verified real-world information.
// Authoritative sources should be added via OfficialSource with isVerified=true.

import {
  PrismaClient,
  PlaceCategory,
  PlaceStatus,
  TrustLevel,
  VisibilityLevel,
  UserRole,
  VerificationSourceType,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Phase 0 database seed (DEMO DATA)...');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@bengaluruoutdoor.in' },
    update: {},
    create: {
      email: 'admin@bengaluruoutdoor.in',
      name: 'Admin User',
      role: UserRole.ADMIN,
      emailVerified: new Date(),
    },
  });

  console.log('✅ Created admin user');

  // Create moderator user
  const moderatorUser = await prisma.user.upsert({
    where: { email: 'moderator@bengaluruoutdoor.in' },
    update: {},
    create: {
      email: 'moderator@bengaluruoutdoor.in',
      name: 'Moderator User',
      role: UserRole.MODERATOR,
      emailVerified: new Date(),
    },
  });

  console.log('✅ Created moderator user');

  // Create contributor user
  const contributorUser = await prisma.user.upsert({
    where: { email: 'contributor@bengaluruoutdoor.in' },
    update: {},
    create: {
      email: 'contributor@bengaluruoutdoor.in',
      name: 'Contributor User',
      role: UserRole.CONTRIBUTOR,
      emailVerified: new Date(),
    },
  });

  console.log('✅ Created contributor user');

  // Create regular user
  const regularUser = await prisma.user.upsert({
    where: { email: 'user@bengaluruoutdoor.in' },
    update: {},
    create: {
      email: 'user@bengaluruoutdoor.in',
      name: 'Regular User',
      role: UserRole.USER,
      emailVerified: new Date(),
    },
  });

  console.log('✅ Created regular user');

  // Create profiles for users
  await prisma.profile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      bio: 'Platform administrator',
      location: 'Bengaluru, Karnataka',
      trustScore: 100,
    },
  });

  await prisma.profile.upsert({
    where: { userId: moderatorUser.id },
    update: {},
    create: {
      userId: moderatorUser.id,
      bio: 'Community moderator and trek leader',
      location: 'Bengaluru, Karnataka',
      trustScore: 90,
    },
  });

  await prisma.profile.upsert({
    where: { userId: contributorUser.id },
    update: {},
    create: {
      userId: contributorUser.id,
      bio: 'Active contributor and outdoor enthusiast',
      location: 'Bengaluru, Karnataka',
      trustScore: 75,
    },
  });

  await prisma.profile.upsert({
    where: { userId: regularUser.id },
    update: {},
    create: {
      userId: regularUser.id,
      bio: 'Weekend explorer',
      location: 'Bengaluru, Karnataka',
      trustScore: 10,
    },
  });

  console.log('✅ Created user profiles');

  // Create demo places
  // NOTE: These are DEMO/SEED entries for development only.
  // They are NOT verified real-world data.
  // Real deployments should populate via OfficialSource with isVerified=true.
  const demoPlaces = [
    {
      name: 'Nandi Hills (DEMO)',
      slug: 'nandi-hills-demo',
      description:
        'DEMO ENTRY: Nandi Hills is an ancient hill fortress in the Chikkaballapur district. This is a demo seed entry for development.',
      shortDescription: 'Demo: Iconic sunrise viewpoint with historic fort ruins',
      category: PlaceCategory.VIEWPOINT,
      subcategory: 'Hill Fort',
      // Location: 13.3709, 77.6826 (Nandi Hills)
      location: { type: 'Point', coordinates: [77.6826, 13.3709] },
      region: 'Chikkaballapur',
      locality: 'Nandi Hills',
      difficulty: 2,
      trailDistanceKm: 4.5,
      durationHours: 3,
      elevationM: 1478,
      elevationGainM: 400,
      openingTime: '06:00',
      closingTime: '18:00',
      lastEntryTime: '17:00',
      entryFeeInr: 50,
      permitRequired: false,
      hasParking: true,
      parkingDetails: 'Large parking lot at the base and near the top',
      hasWater: true,
      waterDetails: 'Drinking water available at multiple points',
      hasNetwork: true,
      networkDetails: 'Good 4G coverage from all major providers',
      crowdLevel: 4,
      bestSeasonStart: 10,
      bestSeasonEnd: 3,
      status: PlaceStatus.OPEN,
      trustScore: 95,
      trustLevel: TrustLevel.VERIFIED,
      visibilityLevel: VisibilityLevel.PUBLIC_EXACT,
      lastVerifiedAt: new Date('2024-12-01'),
      verificationNotes:
        'DEMO: Verified by Karnataka Tourism Department and Forest Department (seed data)',
      createdById: adminUser.id,
      sourceReferences: [
        {
          type: 'demo',
          title: 'Karnataka Tourism Official Website',
          url: 'https://karnatakatourism.org',
          accessedAt: new Date().toISOString(),
        },
        {
          type: 'demo',
          title: 'Forest Department Notification',
          url: 'https://aranya.gov.in',
          accessedAt: new Date().toISOString(),
        },
      ],
    },
    {
      name: 'Skandagiri Night Trek (DEMO)',
      slug: 'skandagiri-night-trek-demo',
      description: 'DEMO ENTRY: Skandagiri night trek demo data.',
      shortDescription: 'Demo: Popular night trek with stunning sunrise views',
      category: PlaceCategory.TREK,
      subcategory: 'Night Trek',
      location: { type: 'Point', coordinates: [77.6194, 13.3267] },
      region: 'Chikkaballapur',
      locality: 'Skandagiri',
      difficulty: 3,
      trailDistanceKm: 8,
      durationHours: 5,
      elevationM: 1450,
      elevationGainM: 600,
      openingTime: '00:00',
      closingTime: '12:00',
      lastEntryTime: '02:00',
      entryFeeInr: 250,
      permitRequired: true,
      permitDetails: 'DEMO: Mandatory permit from Karnataka Forest Department.',
      permitUrl: 'https://aranya.gov.in/skandagiri-permit',
      hasParking: true,
      parkingDetails: 'Parking available at base village Kalavara',
      hasWater: false,
      waterDetails: 'No water sources on trail. Carry at least 2L water per person.',
      hasNetwork: true,
      networkDetails: 'Intermittent coverage. Better at summit.',
      crowdLevel: 4,
      bestSeasonStart: 10,
      bestSeasonEnd: 2,
      status: PlaceStatus.PERMIT_REQUIRED,
      trustScore: 88,
      trustLevel: TrustLevel.VERIFIED,
      visibilityLevel: VisibilityLevel.PUBLIC_EXACT,
      lastVerifiedAt: new Date('2024-11-15'),
      verificationNotes: 'DEMO: Permit system verified with Forest Department (seed data)',
      createdById: adminUser.id,
      sourceReferences: [
        {
          type: 'demo',
          title: 'Karnataka Forest Department Permit Portal',
          url: 'https://aranya.gov.in',
          accessedAt: new Date().toISOString(),
        },
      ],
    },
    {
      name: 'Chunchi Falls (DEMO)',
      slug: 'chunchi-falls-demo',
      description: 'DEMO ENTRY: Chunchi Falls demo data.',
      shortDescription: 'Demo: Scenic waterfall near Kanakapura',
      category: PlaceCategory.WATERFALL,
      subcategory: 'River Waterfall',
      location: { type: 'Point', coordinates: [77.4167, 12.4407] },
      region: 'Ramanagara',
      locality: 'Kanakapura',
      difficulty: 2,
      trailDistanceKm: 2,
      durationHours: 2,
      elevationM: 650,
      elevationGainM: 100,
      openingTime: '06:00',
      closingTime: '18:00',
      entryFeeInr: 0,
      permitRequired: false,
      hasParking: true,
      parkingDetails: 'Limited parking near the falls entrance',
      hasWater: true,
      waterDetails: 'River water - not potable. Carry drinking water.',
      hasNetwork: false,
      networkDetails: 'Poor to no network coverage in the area',
      crowdLevel: 3,
      bestSeasonStart: 8,
      bestSeasonEnd: 11,
      status: PlaceStatus.OPEN,
      trustScore: 82,
      trustLevel: TrustLevel.COMMUNITY_SUBMITTED,
      visibilityLevel: VisibilityLevel.PUBLIC_EXACT,
      lastVerifiedAt: new Date('2024-10-20'),
      verificationNotes: 'DEMO: Community verified. Seasonal access - check water levels.',
      createdById: contributorUser.id,
      sourceReferences: [
        { type: 'demo', title: 'Community visit reports', accessedAt: new Date().toISOString() },
        {
          type: 'demo',
          title: 'Satellite imagery verification',
          accessedAt: new Date().toISOString(),
        },
      ],
    },
    {
      name: 'Savandurga Hill (DEMO)',
      slug: 'savandurga-hill-demo',
      description: 'DEMO ENTRY: Savandurga demo data.',
      shortDescription: "Demo: Asia's largest monolith hill",
      category: PlaceCategory.MOUNTAIN,
      subcategory: 'Monolith Hill',
      location: { type: 'Point', coordinates: [77.2833, 12.9167] },
      region: 'Ramanagara',
      locality: 'Savandurga',
      difficulty: 4,
      trailDistanceKm: 6,
      durationHours: 4,
      elevationM: 1226,
      elevationGainM: 500,
      openingTime: '06:00',
      closingTime: '18:00',
      lastEntryTime: '15:00',
      entryFeeInr: 0,
      permitRequired: false,
      hasParking: true,
      parkingDetails: 'Parking at base near the temple',
      hasWater: false,
      waterDetails: 'No water sources. Carry sufficient water.',
      hasNetwork: true,
      networkDetails: 'Good coverage at base, intermittent on trail',
      crowdLevel: 3,
      bestSeasonStart: 11,
      bestSeasonEnd: 2,
      status: PlaceStatus.OPEN,
      trustScore: 90,
      trustLevel: TrustLevel.VERIFIED,
      visibilityLevel: VisibilityLevel.PUBLIC_EXACT,
      lastVerifiedAt: new Date('2024-11-01'),
      verificationNotes: 'DEMO: Verified by Forest Department (seed data)',
      createdById: adminUser.id,
      sourceReferences: [
        {
          type: 'demo',
          title: 'Ramanagara Forest Division',
          url: 'https://aranya.gov.in',
          accessedAt: new Date().toISOString(),
        },
        {
          type: 'demo',
          title: 'Archaeological Survey of India',
          accessedAt: new Date().toISOString(),
        },
      ],
    },
    {
      name: 'Makalidurga Trek (DEMO)',
      slug: 'makalidurga-trek-demo',
      description: 'DEMO ENTRY: Makalidurga demo data.',
      shortDescription: 'Demo: Easy hill fort trek with railway tunnel',
      category: PlaceCategory.TREK,
      subcategory: 'Hill Fort',
      location: { type: 'Point', coordinates: [77.5333, 13.2833] },
      region: 'Bengaluru Rural',
      locality: 'Doddaballapur',
      difficulty: 2,
      trailDistanceKm: 3,
      durationHours: 2.5,
      elevationM: 1117,
      elevationGainM: 300,
      openingTime: '06:00',
      closingTime: '18:00',
      entryFeeInr: 0,
      permitRequired: false,
      hasParking: true,
      parkingDetails: 'Parking available at base near railway station',
      hasWater: false,
      waterDetails: 'No water on trail. Carry water from base.',
      hasNetwork: true,
      networkDetails: 'Good coverage throughout',
      crowdLevel: 2,
      bestSeasonStart: 10,
      bestSeasonEnd: 3,
      status: PlaceStatus.OPEN,
      trustScore: 85,
      trustLevel: TrustLevel.VERIFIED,
      visibilityLevel: VisibilityLevel.PUBLIC_EXACT,
      lastVerifiedAt: new Date('2024-11-10'),
      verificationNotes: 'DEMO: Trail verified. Railway tunnel passage confirmed open (seed data)',
      createdById: moderatorUser.id,
      sourceReferences: [
        { type: 'demo', title: 'South Western Railway', accessedAt: new Date().toISOString() },
        { type: 'demo', title: 'Regular trekker reports', accessedAt: new Date().toISOString() },
      ],
    },
    {
      name: 'Anthargange (DEMO)',
      slug: 'anthargange-demo',
      description: 'DEMO ENTRY: Anthargange demo data.',
      shortDescription: 'Demo: Volcanic rock formations and caves',
      category: PlaceCategory.CAVE,
      subcategory: 'Volcanic Caves',
      location: { type: 'Point', coordinates: [78.2833, 13.1333] },
      region: 'Kolar',
      locality: 'Anthargange',
      difficulty: 3,
      trailDistanceKm: 5,
      durationHours: 4,
      elevationM: 950,
      elevationGainM: 350,
      openingTime: '06:00',
      closingTime: '18:00',
      entryFeeInr: 0,
      permitRequired: false,
      hasParking: true,
      parkingDetails: 'Parking near the temple at base',
      hasWater: true,
      waterDetails: 'Natural spring water available - potable',
      hasNetwork: true,
      networkDetails: 'Decent coverage at base, poor in caves',
      crowdLevel: 2,
      bestSeasonStart: 10,
      bestSeasonEnd: 3,
      status: PlaceStatus.OPEN,
      trustScore: 80,
      trustLevel: TrustLevel.COMMUNITY_SUBMITTED,
      visibilityLevel: VisibilityLevel.PUBLIC_EXACT,
      lastVerifiedAt: new Date('2024-10-15'),
      verificationNotes:
        'DEMO: Cave conditions vary. Community reports indicate some passages blocked.',
      createdById: contributorUser.id,
      sourceReferences: [
        { type: 'demo', title: 'Cave exploration reports', accessedAt: new Date().toISOString() },
        { type: 'demo', title: 'Geological survey data', accessedAt: new Date().toISOString() },
      ],
    },
    {
      name: 'Ramadevara Betta (DEMO)',
      slug: 'ramanagara-ramadevara-betta-demo',
      description: 'DEMO ENTRY: Ramadevara Betta demo data.',
      shortDescription: 'Demo: Sholay filming location, vulture sanctuary',
      category: PlaceCategory.HIKE,
      subcategory: 'Hill Temple',
      location: { type: 'Point', coordinates: [77.2812, 12.7214] },
      region: 'Ramanagara',
      locality: 'Ramanagara',
      difficulty: 2,
      trailDistanceKm: 2.5,
      durationHours: 2,
      elevationM: 950,
      elevationGainM: 200,
      openingTime: '06:00',
      closingTime: '18:00',
      entryFeeInr: 0,
      permitRequired: false,
      hasParking: true,
      parkingDetails: 'Parking at base near the arch',
      hasWater: false,
      waterDetails: 'No water sources. Carry water.',
      hasNetwork: true,
      networkDetails: 'Good 4G coverage',
      crowdLevel: 3,
      bestSeasonStart: 11,
      bestSeasonEnd: 2,
      status: PlaceStatus.OPEN,
      trustScore: 87,
      trustLevel: TrustLevel.VERIFIED,
      visibilityLevel: VisibilityLevel.PUBLIC_EXACT,
      lastVerifiedAt: new Date('2024-11-20'),
      verificationNotes: 'DEMO: Vulture sanctuary status verified (seed data)',
      createdById: adminUser.id,
      sourceReferences: [
        {
          type: 'demo',
          title: 'Karnataka Forest Department',
          url: 'https://aranya.gov.in',
          accessedAt: new Date().toISOString(),
        },
        {
          type: 'demo',
          title: 'Ramanagara District Tourism',
          accessedAt: new Date().toISOString(),
        },
      ],
    },
    {
      name: 'Devarayanadurga (DEMO)',
      slug: 'devarayanadurga-demo',
      description: 'DEMO ENTRY: Devarayanadurga demo data.',
      shortDescription: 'Demo: Hill station with ancient temples',
      category: PlaceCategory.FORT,
      subcategory: 'Hill Station',
      location: { type: 'Point', coordinates: [77.2167, 13.2333] },
      region: 'Tumkur',
      locality: 'Devarayanadurga',
      difficulty: 2,
      trailDistanceKm: 5,
      durationHours: 3,
      elevationM: 1200,
      elevationGainM: 300,
      openingTime: '06:00',
      closingTime: '18:00',
      entryFeeInr: 0,
      permitRequired: false,
      hasParking: true,
      parkingDetails: 'Multiple parking areas near temples',
      hasWater: true,
      waterDetails: 'Natural springs - potable water available',
      hasNetwork: true,
      networkDetails: 'Good coverage in most areas',
      crowdLevel: 3,
      bestSeasonStart: 10,
      bestSeasonEnd: 3,
      status: PlaceStatus.OPEN,
      trustScore: 88,
      trustLevel: TrustLevel.VERIFIED,
      visibilityLevel: VisibilityLevel.PUBLIC_EXACT,
      lastVerifiedAt: new Date('2024-11-05'),
      verificationNotes: 'DEMO: Temple complex verified. Springs tested for potability (seed data)',
      createdById: adminUser.id,
      sourceReferences: [
        {
          type: 'demo',
          title: 'Tumkur District Administration',
          accessedAt: new Date().toISOString(),
        },
        {
          type: 'demo',
          title: 'Archaeological Survey of India',
          accessedAt: new Date().toISOString(),
        },
      ],
    },
  ];

  for (const placeData of demoPlaces) {
    // Convert GeoJSON Point to PostGIS geography
    const { location, ...rest } = placeData;

    const place = await prisma.place.upsert({
      where: { slug: placeData.slug },
      update: {},
      create: {
        ...rest,
        // Use raw query to set geography point
      },
    });

    // Set the geography point via raw SQL
    await prisma.$executeRawUnsafe(
      `UPDATE "Place" SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE slug = $3`,
      location.coordinates[0],
      location.coordinates[1],
      placeData.slug
    );

    console.log(`✅ Created demo place: ${place.name}`);
  }

  // Create official sources (DEMO)
  const officialSources = [
    {
      name: 'Karnataka Forest Department (DEMO)',
      type: VerificationSourceType.OFFICIAL_PARK_AUTHORITY,
      url: 'https://aranya.gov.in',
      contactEmail: 'info@aranya.gov.in',
      contactPhone: '+91-80-23341234',
      description:
        'DEMO: Primary authority for forest areas, trekking permits, and wildlife sanctuaries in Karnataka',
      isVerified: false, // DEMO - not actually verified
      lastCheckedAt: new Date(),
    },
    {
      name: 'Karnataka Tourism Department (DEMO)',
      type: VerificationSourceType.OFFICIAL_TOURISM_BOARD,
      url: 'https://karnatakatourism.org',
      contactEmail: 'tourism@karnataka.gov.in',
      contactPhone: '+91-80-22254444',
      description: 'DEMO: Official tourism board for Karnataka state',
      isVerified: false,
      lastCheckedAt: new Date(),
    },
    {
      name: 'Archaeological Survey of India - Bengaluru Circle (DEMO)',
      type: VerificationSourceType.OFFICIAL_GOVERNMENT,
      url: 'https://asi.nic.in',
      contactEmail: 'asibangalore@asi.nic.in',
      contactPhone: '+91-80-25537555',
      description: 'DEMO: Government body responsible for archaeological sites and monuments',
      isVerified: false,
      lastCheckedAt: new Date(),
    },
  ];

  for (const sourceData of officialSources) {
    await prisma.officialSource.upsert({
      where: { id: sourceData.name }, // Using name as unique identifier for demo
      update: {},
      create: sourceData,
    });
    console.log(`✅ Created demo official source: ${sourceData.name}`);
  }

  console.log('🎉 Phase 0 database seed completed (DEMO DATA ONLY)!');
  console.log(
    '⚠️  Remember: All seeded data is DEMO/SEED data, not verified real-world information.'
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
