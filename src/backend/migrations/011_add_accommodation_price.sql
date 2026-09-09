-- Total price for the whole stay, set by whoever adds the accommodation.
-- Nullable: it's optional (the person adding it might not know it yet, or
-- the accommodation is free), and accommodations created before this
-- migration simply have no price recorded — same backward-compatible
-- pattern as 007_add_accommodation_spots.sql. Per-night and per-person
-- shares are derived from this at read time (routes/accommodations.js),
-- not stored.
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
