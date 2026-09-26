// Commute time input (docs/01 LDP section 11). No routing provider is licensed yet, so this is a
// straight line estimate shown as a range with a Low confidence label and a disclaimer.

export function haversineKm([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Roads are rarely straight: typical urban detour factor. */
const DETOUR = 1.3;

export type CommuteEstimate = { distanceKm: number; car: [number, number]; transit: [number, number] };

export function estimateCommute(from: [number, number], to: [number, number]): CommuteEstimate {
  const straight = haversineKm(from, to);
  const road = straight * DETOUR;
  const minutes = (km: number, kmh: number) => Math.max(1, Math.round((km / kmh) * 60));
  return {
    distanceKm: Math.round(straight * 10) / 10,
    // Urban driving averages about 25 to 45 km/h including stops.
    car: [minutes(road, 45), minutes(road, 25)],
    // Transit averages about 13 to 22 km/h, plus walking and waiting.
    transit: [minutes(road, 22) + 8, minutes(road, 13) + 15],
  };
}
