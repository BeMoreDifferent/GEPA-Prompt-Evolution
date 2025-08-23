import { sampleMinibatch, avg, argmax } from '../../src/gepa/helpers.js';
import type { TaskItem } from '../../src/types.js';

describe('helpers', () => {
  describe('sampleMinibatch', () => {
    const items: TaskItem[] = [
      { id: '1', user: 'a' },
      { id: '2', user: 'b' },
      { id: '3', user: 'c' },
      { id: '4', user: 'd' },
      { id: '5', user: 'e' },
    ];

    test('returns n items', () => {
      const batch = sampleMinibatch(items, 3);
      expect(batch.length).toBe(3);
    });

    test('returns all items if n is larger than array size', () => {
      const batch = sampleMinibatch(items, 10);
      expect(batch.length).toBe(5);
    });

    test('returns unique items', () => {
      const batch = sampleMinibatch(items, 4);
      const ids = batch.map(item => item.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe('avg', () => {
    test('calculates the average of an array of numbers', () => {
      expect(avg([1, 2, 3, 4, 5])).toBe(3);
    });

    test('returns 0 for an empty array', () => {
      expect(avg([])).toBe(0);
    });
  });

  describe('argmax', () => {
    test('returns the index of the largest number in an array', () => {
      expect(argmax([1, 5, 2, 4, 3])).toBe(1);
    });

    test('returns 0 for an empty array', () => {
      expect(argmax([])).toBe(0);
    });

    test('returns the first index in case of a tie', () => {
      expect(argmax([1, 5, 2, 5, 3])).toBe(1);
    });
  });
});
