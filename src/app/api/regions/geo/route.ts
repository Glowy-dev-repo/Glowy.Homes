import { sqlClient } from "@/db";

// City and neighborhood outlines as simplified GeoJSON: the map's base layer when no tile
// provider key is configured, and neighborhood outlines on top of tiles when one is.
export const revalidate = 86400;

export async function GET() {
  const [{ collection }] = await sqlClient<{ collection: unknown }[]>`
    select json_build_object(
      'type', 'FeatureCollection',
      'features', coalesce(json_agg(json_build_object(
        'type', 'Feature',
        'properties', json_build_object('type', r.type, 'name', r.name, 'slug', r.slug),
        'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(r.boundary::geometry, 0.0008), 5)::json
      )), '[]'::json)
    ) as collection
    from regions r
    where r.type in ('city', 'neighborhood') and r.boundary is not null`;
  return Response.json(collection, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}
