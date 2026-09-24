import { describe, it, expect } from 'vitest';
import { sortByDateConfidence, type DateConfidence } from '../sortByDateConfidence';

interface Item {
  id: string;
  dateConfidence: DateConfidence;
}

function item(id: string, dateConfidence: DateConfidence): Item {
  return { id, dateConfidence };
}

describe('sortByDateConfidence', () => {
  it('sorts unknown before approximate before exact', () => {
    const items = [item('a', 'exact'), item('b', 'unknown'), item('c', 'approximate')];
    const result = sortByDateConfidence(items);
    expect(result.map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('is a stable sort - same-confidence items keep their original relative order', () => {
    const items = [
      item('a', 'exact'),
      item('b', 'unknown'),
      item('c', 'exact'),
      item('d', 'unknown'),
      item('e', 'exact'),
    ];
    const result = sortByDateConfidence(items);
    expect(result.map((i) => i.id)).toEqual(['b', 'd', 'a', 'c', 'e']);
  });

  it('returns an empty array unchanged', () => {
    expect(sortByDateConfidence([])).toEqual([]);
  });

  it('leaves an already-sorted or all-same-confidence list in the same order', () => {
    const items = [item('a', 'exact'), item('b', 'exact'), item('c', 'exact')];
    expect(sortByDateConfidence(items).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const items = [item('a', 'exact'), item('b', 'unknown')];
    const original = [...items];
    sortByDateConfidence(items);
    expect(items).toEqual(original);
  });
});
