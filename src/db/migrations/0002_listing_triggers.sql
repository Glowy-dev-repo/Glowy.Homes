-- docs/02 "Triggers and maintenance" items 1 and 2.
-- BEFORE triggers on one table fire in name order: a_copy_property runs before b_search_vector,
-- so the search vector sees the neighborhood copied from the property.

-- 2. Denormalized property columns on listings, set on insert and when the property changes.
CREATE OR REPLACE FUNCTION listings_copy_property() RETURNS trigger AS $$
BEGIN
  SELECT p.location, p.property_type, p.beds, p.baths, p.sqft, p.city_region_id, p.neighborhood_region_id
    INTO NEW.location, NEW.property_type, NEW.beds, NEW.baths, NEW.sqft, NEW.city_region_id, NEW.neighborhood_region_id
    FROM properties p WHERE p.id = NEW.property_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER listings_a_copy_property
  BEFORE INSERT OR UPDATE OF property_id ON listings
  FOR EACH ROW EXECUTE FUNCTION listings_copy_property();--> statement-breakpoint

CREATE OR REPLACE FUNCTION properties_sync_listings() RETURNS trigger AS $$
BEGIN
  UPDATE listings l SET
    location = NEW.location,
    property_type = NEW.property_type,
    beds = NEW.beds,
    baths = NEW.baths,
    sqft = NEW.sqft,
    city_region_id = NEW.city_region_id,
    neighborhood_region_id = NEW.neighborhood_region_id,
    updated_at = now()
  WHERE l.property_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER properties_sync_listings
  AFTER UPDATE OF location, property_type, beds, baths, sqft, city_region_id, neighborhood_region_id ON properties
  FOR EACH ROW
  WHEN (
    OLD.location IS DISTINCT FROM NEW.location OR OLD.property_type IS DISTINCT FROM NEW.property_type
    OR OLD.beds IS DISTINCT FROM NEW.beds OR OLD.baths IS DISTINCT FROM NEW.baths OR OLD.sqft IS DISTINCT FROM NEW.sqft
    OR OLD.city_region_id IS DISTINCT FROM NEW.city_region_id
    OR OLD.neighborhood_region_id IS DISTINCT FROM NEW.neighborhood_region_id
  )
  EXECUTE FUNCTION properties_sync_listings();--> statement-breakpoint

-- 1. Full text: address and listing id rank highest, then neighborhood and city, then description and features.
CREATE OR REPLACE FUNCTION listings_search_vector() RETURNS trigger AS $$
DECLARE
  addr text;
  place text;
BEGIN
  SELECT concat_ws(' ', p.address_line1, p.address_line2, p.postal_code), p.city
    INTO addr, place
    FROM properties p WHERE p.id = NEW.property_id;
  SELECT concat_ws(' ', place, r.name) INTO place FROM regions r WHERE r.id = NEW.neighborhood_region_id;
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(addr, '') || ' ' || coalesce(NEW.source_listing_id, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(place, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english',
      coalesce((SELECT string_agg(e.item, ' ')
                FROM jsonb_each(NEW.features) AS f(group_name, items),
                     jsonb_array_elements_text(CASE WHEN jsonb_typeof(f.items) = 'array' THEN f.items ELSE '[]'::jsonb END) AS e(item)), '')
    ), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER listings_b_search_vector
  BEFORE INSERT OR UPDATE OF description, features, source_listing_id, property_id, neighborhood_region_id ON listings
  FOR EACH ROW EXECUTE FUNCTION listings_search_vector();
