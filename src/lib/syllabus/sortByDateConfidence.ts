/**
 * Extraction Confidence Review Queue: orders extracted schedule items so
 * the ones actually needing a look (an approximate or missing date) surface
 * first, instead of sitting wherever the model happened to return them in a
 * long extraction. A stable sort - ties broken by original position - keeps
 * same-confidence items in their original relative order rather than
 * shuffling them on every call.
 */

export type DateConfidence = 'exact' | 'approximate' | 'unknown';

const CONFIDENCE_RANK: Record<DateConfidence, number> = {
  unknown: 0,
  approximate: 1,
  exact: 2,
};

export function sortByDateConfidence<T extends { dateConfidence: DateConfidence }>(
  items: T[],
): T[] {
  return items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => {
      const rankDiff =
        CONFIDENCE_RANK[a.item.dateConfidence] - CONFIDENCE_RANK[b.item.dateConfidence];
      return rankDiff !== 0 ? rankDiff : a.originalIndex - b.originalIndex;
    })
    .map(({ item }) => item);
}
