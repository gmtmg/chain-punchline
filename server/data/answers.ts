import type { AnswerOption } from "../../shared/types";
import { ANSWER_CARDS_PER_HAND } from "../../shared/constants";
import { categories } from "./categories";

/**
 * Draw `count` answer cards from the category's pool for a given round (1-based).
 * Returns unique cards per call using shuffle on a copy.
 */
export function drawAnswerCards(
  categoryId: string,
  round: number,
  count: number = ANSWER_CARDS_PER_HAND
): AnswerOption[] {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    // Fallback to first category
    return drawAnswerCards(categories[0].id, round, count);
  }

  const pools = [category.round1, category.round2, category.round3];
  const pool = pools[round - 1] || pools[0];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((text, i) => ({
    id: `a-${round}-${i}-${Date.now().toString(36)}`,
    text,
  }));
}
