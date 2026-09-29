"use client";

import { useRouter } from "next/navigation";
import { market } from "@/config/market";
import { SearchBar } from "./SearchBar";

/** Home page search: one box for homes for sale by city, neighborhood, address or ZIP code. */
export function HeroSearch() {
  const router = useRouter();
  const placeholder = `City, neighborhood, address or ${market.postalLabel}`;
  return (
    <SearchBar
      size="lg"
      listingType="sale"
      placeholder={placeholder}
      label={placeholder}
      onSubmitText={(text) => {
        const qs = new URLSearchParams({ type: "sale" });
        if (text) qs.set("q", text);
        router.push(`/search?${qs}`);
      }}
    />
  );
}
