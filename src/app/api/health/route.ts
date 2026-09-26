import { sqlClient } from "@/db";

// Render health check: the app is up and can reach the database.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sqlClient`select 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
