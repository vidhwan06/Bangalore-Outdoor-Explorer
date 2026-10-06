-- Enable PostGIS extension (required for geography/geometry types)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Do NOT enable postgis_topology, fuzzystrmatch, or postgis_tiger_geocoder
-- They are not required for Phase 0 and add unnecessary attack surface.