/* Lists, whatever is in them. It needs no page. */

/** Each item once, where it first comes: an item is another's double when
    `keyOf` says the same of both. */
export function onceEach<Item>(items: Item[], keyOf: (item: Item) => string): Item[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
