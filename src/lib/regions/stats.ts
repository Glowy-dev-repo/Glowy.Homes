import type postgres from "postgres";

/**
 * refresh_region_stats (docs/03 section 4): per city and neighborhood, active sale and rent
 * counts, median list price, median rent, median price per sqft, 30 day sold count and
 * median days on market. Merged into regions.stats so other keys survive.
 */
export async function refreshRegionStats(sql: postgres.Sql): Promise<number> {
  const rows = await sql`
    with membership as (
      select l.city_region_id as region_id, l.* from listings l where l.city_region_id is not null
      union all
      select l.neighborhood_region_id as region_id, l.* from listings l where l.neighborhood_region_id is not null
    ),
    agg as (
      select region_id,
        count(*) filter (where listing_type = 'sale' and status = 'active') as sale_count,
        count(*) filter (where listing_type = 'rent' and status = 'active') as rent_count,
        percentile_cont(0.5) within group (order by price) filter (where listing_type = 'sale' and status = 'active') as median_price,
        percentile_cont(0.5) within group (order by price) filter (where listing_type = 'rent' and status = 'active') as median_rent,
        percentile_cont(0.5) within group (order by price::float8 / sqft)
          filter (where listing_type = 'sale' and status = 'active' and sqft > 0) as median_ppsf,
        count(*) filter (where listing_type = 'sale' and status = 'sold' and sold_date >= current_date - 30) as sold_30d,
        percentile_cont(0.5) within group (order by current_date - list_date)
          filter (where listing_type = 'sale' and status = 'active') as median_dom
      from membership
      group by region_id
    )
    update regions r set stats = r.stats || jsonb_build_object(
      'listing_count', coalesce(a.sale_count, 0),
      'rent_count', coalesce(a.rent_count, 0),
      'median_price', round(a.median_price),
      'median_rent', round(a.median_rent),
      'median_ppsf', round(a.median_ppsf),
      'sold_30d', coalesce(a.sold_30d, 0),
      'median_dom', round(a.median_dom),
      'updated_at', now()
    )
    from regions r2 left join agg a on a.region_id = r2.id
    where r.id = r2.id and r.type in ('city', 'neighborhood')
    returning r.id`;
  return rows.length;
}
