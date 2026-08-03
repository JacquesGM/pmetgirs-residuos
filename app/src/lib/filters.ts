export function uniqueOptions<T, K extends string>(items: T[], getValue: (item: T) => K): K[] {
  return Array.from(new Set(items.map(getValue))).sort();
}
