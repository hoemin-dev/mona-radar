const priority = [
  "PUBLIC_SEWAGE", "SEWAGE_SLUDGE", "INCINERATION", "PUBLIC_WASTEWATER",
  "FOOD_WASTE", "WATER_TREATMENT", "SEPTAGE", "LIVESTOCK_MANURE", "LANDFILL"
]
;

export const CATEGORY_PRIORITY: readonly string[] = priority;
export function categoryRank(category: string): number {
  const rank = CATEGORY_PRIORITY.indexOf(category);
  return rank < 0 ? Infinity : rank;
}
export function compareCategories(a: string, b: string): number {
  return categoryRank(a) - categoryRank(b) || a.localeCompare(b);
}
