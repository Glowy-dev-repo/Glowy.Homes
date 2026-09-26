/**
 * drizzle-kit quotes custom column types, which turns `geography(point, 4326)` into an
 * identifier Postgres cannot resolve. Unquotes PostGIS types in generated SQL.
 */
export function unquotePostgisTypes(sql: string): string {
  return sql.replace(/"(geography|geometry)\(([^)"]+)\)"/g, "$1($2)");
}
