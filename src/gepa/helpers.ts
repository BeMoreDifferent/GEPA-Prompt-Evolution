import type { TaskItem } from '../types.js';

export function sampleMinibatch(arr: TaskItem[], n: number): TaskItem[] {
  if (n >= arr.length) return [...arr];
  const pick = new Set<number>(), out: TaskItem[] = [];
  while (out.length < n && pick.size < arr.length) {
    const i = Math.floor(Math.random() * arr.length);
    if (!pick.has(i)) { pick.add(i); out.push(arr[i]); }
  }
  return out;
}

export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export const argmax = (xs: number[]) => xs.reduce((bi, x, i, a) => (x > a[bi] ? i : bi), 0);
