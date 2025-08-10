/**
 * Lightweight budget tracker to enforce and introspect token/call budgets.
 *
 * When disabled, all methods are no-ops and `remaining()` always returns the
 * initial start value provided to the constructor. This allows safe wiring
 * into existing call sites without changing behavior.
 */
export class BudgetTracker {
  private readonly start: number;
  private readonly enabled: boolean;
  private remainingInternal: number;

  /**
   * Create a new tracker.
   *
   * @param start - Initial remaining budget (non-negative integer)
   * @param enabled - Whether tracking is active. If false, all operations are no-ops.
   */
  constructor(start: number, enabled: boolean) {
    const safeStart = Number.isFinite(start) && start >= 0 ? Math.floor(start) : 0;
    this.start = safeStart;
    this.enabled = Boolean(enabled);
    this.remainingInternal = safeStart;
  }

  /** Current remaining budget. When disabled, returns the initial `start` value. */
  remaining(): number {
    return this.enabled ? this.remainingInternal : this.start;
  }

  /**
   * Decrease the budget by `n` (defaults to 1). Negative values are ignored.
   * When disabled, this is a no-op.
   *
   * @param n - Amount to decrement (defaults to 1)
   * @param _tag - Optional tag for future attribution (ignored in noop scaffold)
   */
  dec(n: number = 1, _tag?: string): void {
    if (!this.enabled) return;
    const amt = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    if (amt === 0) return;
    this.remainingInternal = Math.max(0, this.remainingInternal - amt);
  }

  /** Whether there is at least `n` budget remaining. Always true when disabled. */
  canAfford(n: number): boolean {
    if (!this.enabled) return true;
    const amt = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    return this.remainingInternal >= amt;
  }
}

export default BudgetTracker;


