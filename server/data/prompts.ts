import { categories, type TopicCategory } from "./categories";

/**
 * Pick a random category, avoiding recently used ones if possible.
 */
export function pickCategory(usedCategoryIds: Set<string> = new Set()): TopicCategory {
  const available = categories.filter((c) => !usedCategoryIds.has(c.id));
  const pool = available.length > 0 ? available : categories;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Get `count` topics from a specific category, avoiding already-used topics.
 */
export function getTopics(
  categoryId: string,
  count: number,
  usedTopics: Set<string>
): string[] {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    // Fallback: pick random category
    const fallback = categories[Math.floor(Math.random() * categories.length)];
    return getTopics(fallback.id, count, usedTopics);
  }

  const available = category.topics.filter((t) => !usedTopics.has(t));
  const pool = available.length >= count ? available : category.topics;

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count);
  for (const t of picked) {
    usedTopics.add(t);
  }
  return picked;
}
