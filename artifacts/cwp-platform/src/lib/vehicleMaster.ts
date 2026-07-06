/** Maps master-data category slug → vehicle type stored on assets. */
export function categorySlugToVehicleType(categorySlug: string): string {
  const typeMap: Record<string, string> = {
    hatchback: "hatchback",
    sedan: "sedan",
    suv: "suv",
    "compact-suv": "suv",
    crossover: "suv",
    muv: "van",
    mpv: "van",
    luxury: "luxury",
    van: "van",
    pickup: "truck",
  };
  return typeMap[categorySlug.toLowerCase()] ?? "sedan";
}
