export function getDisplayTitle(brevet: {
  name?: string;
  city?: string;
  department?: string;
  region?: string;
  country?: string;
  distance?: number;
}): string {
  if (brevet.name) return brevet.name;
  const location =
    brevet.city || brevet.department || brevet.region || brevet.country;
  return [location, brevet.distance ? `${brevet.distance} km` : null]
    .filter(Boolean)
    .join(' ');
}
