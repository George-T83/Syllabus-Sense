import { describe, it, expect } from 'vitest';
import { withPaddingDefaults } from '../Card';

describe('withPaddingDefaults', () => {
  it('returns the defaults untouched when the caller adds nothing', () => {
    expect(withPaddingDefaults('flex p-6', undefined)).toBe('flex p-6');
  });

  it('drops the default p-6 when the caller sets their own p-*', () => {
    expect(withPaddingDefaults('flex p-6', 'p-0 pb-5').split(' ')).toEqual(['flex', 'p-0', 'pb-5']);
  });

  it('keeps the defaults for sides the caller did not touch', () => {
    expect(withPaddingDefaults('flex p-6', 'pb-2').split(' ')).toEqual(['flex', 'p-6', 'pb-2']);
  });

  it('replaces a default pt-* with the caller pt-*', () => {
    expect(withPaddingDefaults('p-6 pt-0', 'p-0 pt-5').split(' ')).toEqual(['p-0', 'pt-5']);
    expect(withPaddingDefaults('p-6 pt-4 mt-2', 'pt-1').split(' ')).toEqual([
      'p-6',
      'mt-2',
      'pt-1',
    ]);
  });

  it('does not mistake margin or other utilities for padding', () => {
    expect(withPaddingDefaults('p-6 mt-2', 'mt-0 space-y-4').split(' ')).toEqual([
      'p-6',
      'mt-2',
      'mt-0',
      'space-y-4',
    ]);
  });
});
