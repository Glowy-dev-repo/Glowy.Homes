import type { MetadataRoute } from "next";
import { previewPassword } from "@/lib/preview";

// Read at request time, so setting or removing PREVIEW_PASSWORD takes effect without a rebuild.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (previewPassword()) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/account", "/pro/", "/landlord", "/admin", "/api/"] } };
}
