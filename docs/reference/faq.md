# Frequently Asked Questions

Common questions and answers about GEPA (Genetic-Pareto) Prompt Evolution.

## 🚀 Getting Started

### Q: How do I get started with GEPA?

**A**: Start with the [Quick Start Guide](../getting-started/quick-start.md). You'll need:
1. Node.js >= 18
2. OpenAI API key
3. Input JSON with your prompts
4. Configuration JSON with optimization settings

```bash
export OPENAI_API_KEY="your-api-key"
npx gepa-spo --input input.json --config config.json --log
```

### Q: Do I need to install GEPA locally?

**A**: No! GEPA runs via `npx` without installation. Just run:
```bash
npx gepa-spo --help
```

### Q: What's the minimum budget I need?

**A**: GEPA requires at least 10 budget units, but recommends 50-200 for meaningful optimization. The budget represents total LLM calls (execution + evaluation).

## ⚙️ Configuration

### Q: How do I choose the right budget?

**A**: Budget depends on your dataset size and optimization goals:
- **Small datasets (5-10 prompts)**: 50-100 budget
- **Medium datasets (10-20 prompts)**: 100-200 budget  
- **Large datasets (20+ prompts)**: 200+ budget
- **Modular systems**: Add 50-100 extra budget per module

### Q: What's the difference between `paretoSize` and `minibatchSize`?

**A**: 
- **`paretoSize`**: Items used for multi-objective evaluation and candidate ranking
- **`minibatchSize`**: Items evaluated per iteration during optimization

For a dataset of 20 prompts, you might use:
```json
{
  "paretoSize": 8,    // 8 items for Pareto evaluation
  "minibatchSize": 4, // 4 items per iteration
  "holdoutSize": 2    // 2 items for validation
}
```

### Q: When should I use crossover vs mutation?

**A**: 
- **Single systems**: Use `crossoverProb: 0` (mutation only)
- **Modular systems**: Use `crossoverProb: 0.2-0.4` for intelligent module merging
- **Large budgets**: Higher crossover probability can help discover novel combinations

### Q: What models should I use?

**A**: 
- **Default**: `gpt-5-mini` for both actor and judge (cost-effective)
- **High quality**: `gpt-4` for both (better performance, higher cost)
- **Mixed**: `gpt-5-mini` for execution, `gpt-4` for evaluation

## 📊 Performance & Results

### Q: How do I know if optimization is working?

**A**: Enable logging with `--log` to see:
- Initial vs final performance scores
- Percentage improvements
- Iteration-by-iteration progress
- Acceptance rates and operation types

### Q: What if I'm not seeing improvements?

**A**: Try these steps:
1. **Increase budget**: More iterations = more optimization opportunities
2. **Adjust rubric**: Make evaluation criteria more specific
3. **Check data quality**: Ensure your prompts are diverse and challenging
4. **Try different strategies**: GEPA adapts strategies automatically

### Q: How do I interpret the performance statistics?

**A**: Key metrics to watch:
- **Percentage Improvement**: Should be positive and significant (>10%)
- **Acceptance Rate**: 30-70% is normal, too low/high may indicate issues
- **Budget Efficiency**: Higher score per budget unit = better optimization
- **Strategy Switches**: Shows GEPA is adapting to your domain

### Q: Can I resume an interrupted run?

**A**: Yes! GEPA automatically saves state and can resume:
```bash
npx gepa-spo --resume ./runs/previous-run-directory
```

## 🧩 Modular Systems

### Q: When should I use modular systems?

**A**: Use modular systems when you have:
- **Specialized components**: Different aspects (personality, safety, instructions)
- **Reusable modules**: Components that work across different systems
- **Complex requirements**: Multiple objectives that benefit from separate optimization

### Q: How do I design good modules?

**A**: Follow these principles:
1. **Clear responsibilities**: Each module has one well-defined purpose
2. **Independence**: Modules work well on their own
3. **Consistency**: Modules have similar input/output expectations
4. **Non-overlapping**: Avoid conflicts between modules

### Q: How does crossover work with modules?

**A**: GEPA performs intelligent module merging:
- Tracks which modules changed in each candidate
- Selects modules based on change history and performance
- Ensures novel combinations (not direct relatives)
- Preserves complementary strengths from different parents

## 🔧 Technical Questions

### Q: How does GEPA differ from other optimization methods?

**A**: GEPA's key innovations:
- **Language-native reflection**: Uses textual feedback, not just scores
- **Pareto frontier**: Maintains diverse candidates, not single best
- **Sample efficiency**: Achieves large gains with few rollouts
- **System-aware evolution**: Optimizes compound AI systems

### Q: What's the difference between μ (mu) and μf (muf)?

**A**: 
- **μ (mu)**: Simple numeric scoring function
- **μf (muf)**: Feedback function that returns score + textual feedback

GEPA recommends using μf for better optimization:
```typescript
const muf = async ({ item, output }) => ({
  score: 0.8,
  feedbackText: "Good response, but could be more concise"
});
```

### Q: How does the strategy bandit work?

**A**: GEPA uses UCB1 bandit algorithm to:
- **Explore**: Try different optimization strategies
- **Exploit**: Focus on strategies that work well
- **Adapt**: Switch strategies when performance plateaus
- **Learn**: Track strategy effectiveness over time

### Q: What are execution traces?

**A**: Execution traces include:
- **System context**: What prompt was used
- **Execution steps**: How the system processed input
- **Timing information**: Performance characteristics
- **Metadata**: Additional context about the task

Traces help GEPA understand why certain responses succeeded or failed.

## 🆘 Troubleshooting

### Q: I'm getting "Budget too small" errors

**A**: Increase your budget in config.json:
```json
{
  "budget": 100  // Minimum 10, recommended 50-200
}
```

### Q: My data split is impossible

**A**: Your paretoSize + holdoutSize >= total prompts. Solutions:
- Add more prompts to your dataset
- Reduce paretoSize or holdoutSize
- Use holdoutSize: 0 for small datasets

### Q: API key errors

**A**: Set your OpenAI API key:
```bash
export OPENAI_API_KEY="your-api-key"
# Or use --api-key flag
npx gepa-spo --api-key "your-api-key" --input input.json --config config.json
```

### Q: Lock file exists error

**A**: Another GEPA process is running or crashed. Solutions:
- Wait for the other process to finish
- Check if a process is still running
- Manually remove `.lock` file if safe (no other process running)

### Q: No improvement in performance

**A**: Try these solutions:
1. **Increase budget**: More iterations needed
2. **Improve rubric**: Make evaluation criteria more specific
3. **Check data quality**: Ensure diverse, challenging prompts
4. **Adjust parameters**: Try different minibatchSize, paretoSize
5. **Review seed prompt**: Start with a reasonable baseline

## 💰 Cost & Efficiency

### Q: How much does optimization cost?

**A**: Cost depends on:
- **Budget size**: Each budget unit = 1-2 LLM calls
- **Model choice**: gpt-5-mini is ~10x cheaper than gpt-4
- **Dataset size**: More prompts = more evaluation calls

Typical costs:
- **Small optimization (50 budget)**: $1-5
- **Medium optimization (100 budget)**: $2-10
- **Large optimization (200 budget)**: $4-20

### Q: How can I reduce costs?

**A**: 
- Use `gpt-5-mini` instead of `gpt-4`
- Start with smaller budgets and increase if needed
- Use smaller datasets for initial testing
- Enable `mufCosts: false` to exclude judge calls from budget

### Q: Is GEPA sample-efficient?

**A**: Yes! GEPA achieves large quality gains with few rollouts:
- **35× fewer rollouts** than some baseline methods
- **10-20% better performance** than GRPO
- **>10% better performance** than MIPROv2

## 🔮 Advanced Usage

### Q: Can I use custom LLM providers?

**A**: Yes, via the `baseURL` configuration:
```json
{
  "baseURL": "https://your-custom-endpoint.com/v1"
}
```

### Q: How do I create custom strategies?

**A**: Create a custom strategies file:
```json
[
  {
    "id": "my-strategy",
    "hint": "Apply domain-specific optimization techniques"
  }
]
```

Then reference it in config:
```json
{
  "strategiesPath": "strategies/my-strategies.json"
}
```

### Q: Can I integrate GEPA into my application?

**A**: Yes! Use the programmatic API:
```typescript
import { runGEPA_System } from 'gepa-spo/dist/gepa.js';

const best = await runGEPA_System(seed, taskItems, options);
```

### Q: How do I analyze optimization results?

**A**: GEPA saves detailed data:
- `statistics.json`: Performance metrics and improvements
- `iterations/`: Per-iteration data for analysis
- `best.json`: Best performing prompt
- Console output: Real-time progress and final statistics

---

**Still have questions? Check out the [Troubleshooting Guide](troubleshooting.md) or [open an issue](https://github.com/BeMoreDifferent/GEPA-Prompt-Evolution/issues) on GitHub!**
