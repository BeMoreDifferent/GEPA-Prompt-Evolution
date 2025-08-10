import { calculateImprovement, formatStats } from '../src/cli.js';

describe('Enhanced CLI Logging', () => {
  describe('calculateImprovement', () => {
    it('should calculate positive improvement correctly', () => {
      const result = calculateImprovement(0.5, 0.8);
      expect(result.absolute).toBeCloseTo(0.3, 5);
      expect(result.percentage).toBeCloseTo(60, 5);
    });

    it('should calculate negative improvement correctly', () => {
      const result = calculateImprovement(0.8, 0.5);
      expect(result.absolute).toBeCloseTo(-0.3, 5);
      expect(result.percentage).toBeCloseTo(-37.5, 5);
    });

    it('should handle zero initial score', () => {
      const result = calculateImprovement(0, 0.5);
      expect(result.absolute).toBe(0.5);
      expect(result.percentage).toBe(0); // Can't calculate percentage from zero
    });

    it('should handle no improvement', () => {
      const result = calculateImprovement(0.5, 0.5);
      expect(result.absolute).toBe(0);
      expect(result.percentage).toBe(0);
    });
  });

  describe('formatStats', () => {
    it('should format statistics correctly', () => {
      const stats = {
        initialScore: 0.5,
        finalScore: 0.8,
        iterations: 10,
        budgetUsed: 80,
        totalBudget: 100,
        candidatesGenerated: 15,
        acceptedCandidates: 8,
        crossoverOperations: 3,
        mutationOperations: 5,
        strategySwitches: 2,
        paretoSize: 5,
        feedbackSize: 10,
        holdoutSize: 2
      };

      const result = formatStats(stats);
      
      // Check that all key statistics are included
      expect(result).toContain('📊 PERFORMANCE STATISTICS');
      expect(result).toContain('Initial Score: 0.500');
      expect(result).toContain('Final Score: 0.800');
      expect(result).toContain('Absolute Improvement: 0.300');
      expect(result).toContain('Percentage Improvement: 60.0%');
      expect(result).toContain('Iterations Completed: 10');
      expect(result).toContain('Candidates Generated: 15');
      expect(result).toContain('Candidates Accepted: 8 (53.3%)');
      expect(result).toContain('Crossover Operations: 3 (20.0%)');
      expect(result).toContain('Mutation Operations: 5');
      expect(result).toContain('Strategy Switches: 2');
      expect(result).toContain('Budget Used: 80/100 (80.0%)');
      expect(result).toContain('Data Split: Pareto=5, Feedback=10, Holdout=2');
      expect(result).toContain('Efficiency: 0.0100 score per budget unit');
    });

    it('should handle edge cases', () => {
      const stats = {
        initialScore: 0,
        finalScore: 0.1,
        iterations: 0,
        budgetUsed: 0,
        totalBudget: 100,
        candidatesGenerated: 1,
        acceptedCandidates: 0,
        crossoverOperations: 0,
        mutationOperations: 0,
        strategySwitches: 0,
        paretoSize: 1,
        feedbackSize: 1,
        holdoutSize: 0
      };

      const result = formatStats(stats);
      
      expect(result).toContain('Initial Score: 0.000');
      expect(result).toContain('Final Score: 0.100');
      expect(result).toContain('Percentage Improvement: 0.0%'); // Can't calculate from zero
      expect(result).toContain('Candidates Accepted: 0 (0.0%)');
      expect(result).toContain('Budget Used: 0/100 (0.0%)');
    });
  });
});
