# Configuration Guide

Complete guide to configuring GEPA (Genetic-Pareto) Prompt Evolution for optimal performance.

## 📋 Configuration Overview

GEPA uses a JSON configuration file to control all aspects of the optimization process. The configuration includes model settings, optimization parameters, data splitting, and advanced features.

## 🚀 Basic Configuration

### Minimal Configuration

```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 100,
  "rubric": "Correctness, clarity, and conciseness."
}
```

### Recommended Configuration

```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 150,
  "minibatchSize": 4,
  "paretoSize": 8,
  "holdoutSize": 2,
  "epsilonHoldout": 0.02,
  "crossoverProb": 0.2,
  "rubric": "Correctness, clarity, safety, and helpfulness.",
  "actorTemperature": 0.4,
  "actorMaxTokens": 512,
  "strategiesPath": "strategies/strategies.json",
  "scoreForPareto": "muf",
  "mufCosts": true
}
```

## 🔧 Configuration Parameters

### Model Configuration

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `actorModel` | string | `gpt-5-mini` | OpenAI model for execution (generating responses) |
| `judgeModel` | string | `gpt-5-mini` | OpenAI model for evaluation (scoring responses) |
| `actorTemperature` | number | `0.4` | Temperature for execution model (0.0-2.0) |
| `actorMaxTokens` | number | `512` | Maximum tokens for execution responses |
| `baseURL` | string | - | Custom API base URL for OpenAI-compatible endpoints |
| `requestTimeoutMs` | number | - | Request timeout in milliseconds |

### Budget and Optimization

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `budget` | number | `50+` | Total LLM calls allowed for optimization |
| `minibatchSize` | number | `4` | Number of feedback items evaluated per iteration |
| `paretoSize` | number | `2+` | Number of items used for Pareto evaluation |
| `holdoutSize` | number | `0` | Number of items reserved for validation |
| `epsilonHoldout` | number | `0.02` | Minimum improvement required for holdout acceptance |
| `crossoverProb` | number | `0` | Probability of crossover vs mutation (0.0-1.0) |

### Evaluation and Scoring

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `rubric` | string | `"Correctness, coverage, safety, brevity."` | Evaluation criteria for optimization |
| `scoreForPareto` | string | `"muf"` | Scoring method: `"mu"` or `"muf"` |
| `mufCosts` | boolean | `true` | Whether judge calls count toward budget |

### Advanced Features

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `strategiesPath` | string | `strategies/strategies.json` | Path to strategies file |
| `seed` | string | - | Custom seed for random number generation |

## 📊 Data Splitting Configuration

### Understanding Data Splits

GEPA splits your training data into three sets:

```
Total Data: [Pareto] [Feedback] [Holdout]
```

- **Pareto Set**: Used for multi-objective evaluation and candidate ranking
- **Feedback Set**: Used for minibatch evaluation during optimization
- **Holdout Set**: Used for final validation and overfitting prevention

### Configuration Examples

#### Small Dataset (5-10 prompts)
```json
{
  "budget": 50,
  "minibatchSize": 2,
  "paretoSize": 3,
  "holdoutSize": 0
}
```

#### Medium Dataset (10-20 prompts)
```json
{
  "budget": 100,
  "minibatchSize": 4,
  "paretoSize": 6,
  "holdoutSize": 2
}
```

#### Large Dataset (20+ prompts)
```json
{
  "budget": 200,
  "minibatchSize": 6,
  "paretoSize": 10,
  "holdoutSize": 4
}
```

### Data Split Validation

GEPA validates your configuration to ensure:
- `paretoSize + holdoutSize < total_prompts`
- `minibatchSize <= total_prompts - paretoSize - holdoutSize`
- `paretoSize >= 1`

## 🎯 Model Selection

### Recommended Model Combinations

#### Cost-Effective (Default)
```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini"
}
```
- **Cost**: ~$0.001-0.005 per budget unit
- **Performance**: Good for most use cases
- **Speed**: Fast response times

#### High Quality
```json
{
  "actorModel": "gpt-4",
  "judgeModel": "gpt-4"
}
```
- **Cost**: ~$0.01-0.05 per budget unit
- **Performance**: Excellent quality
- **Speed**: Slower but more accurate

#### Mixed Approach
```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-4"
}
```
- **Cost**: ~$0.005-0.025 per budget unit
- **Performance**: Good execution, excellent evaluation
- **Speed**: Balanced approach

### Model-Specific Settings

#### GPT-5-Mini
```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "actorTemperature": 0.4,
  "actorMaxTokens": 512
}
```

#### GPT-4
```json
{
  "actorModel": "gpt-4",
  "judgeModel": "gpt-4",
  "actorTemperature": 0.3,
  "actorMaxTokens": 1024
}
```

## 🔄 Optimization Parameters

### Budget Planning

Budget requirements depend on your goals:

| Optimization Goal | Recommended Budget | Expected Improvement |
|-------------------|-------------------|---------------------|
| **Quick test** | 20-50 | 5-15% |
| **Moderate optimization** | 50-100 | 15-30% |
| **Thorough optimization** | 100-200 | 30-50% |
| **Exhaustive optimization** | 200+ | 50%+ |

### Crossover vs Mutation

#### Single Systems (Mutation Only)
```json
{
  "crossoverProb": 0
}
```
- Use for simple system prompts
- Focus on iterative improvement
- Lower computational cost

#### Modular Systems (Crossover Enabled)
```json
{
  "crossoverProb": 0.2
}
```
- Use for multi-component prompts
- Enables intelligent module merging
- Higher computational cost but better results

#### Advanced Crossover
```json
{
  "crossoverProb": 0.4
}
```
- Use for complex modular systems
- Maximum exploration of module combinations
- Requires larger budget

### Minibatch Size

#### Small Minibatches (2-3)
```json
{
  "minibatchSize": 2
}
```
- **Advantages**: Faster iterations, more frequent updates
- **Disadvantages**: Noisier feedback, less stable
- **Use when**: Limited budget, quick optimization

#### Medium Minibatches (4-6)
```json
{
  "minibatchSize": 4
}
```
- **Advantages**: Balanced feedback, stable optimization
- **Disadvantages**: Moderate iteration speed
- **Use when**: Standard optimization scenarios

#### Large Minibatches (6+)
```json
{
  "minibatchSize": 6
}
```
- **Advantages**: Stable feedback, comprehensive evaluation
- **Disadvantages**: Slower iterations, higher cost
- **Use when**: High-quality optimization, large datasets

## 📝 Evaluation Configuration

### Rubric Design

#### Basic Rubric
```json
{
  "rubric": "Correctness, clarity, and conciseness."
}
```

#### Comprehensive Rubric
```json
{
  "rubric": "Correctness, clarity, safety, helpfulness, and adherence to instructions."
}
```

#### Domain-Specific Rubric
```json
{
  "rubric": "Technical accuracy, code quality, security best practices, and user experience."
}
```

### Scoring Methods

#### μ (mu) - Simple Scoring
```json
{
  "scoreForPareto": "mu"
}
```
- Returns numeric score only
- Faster evaluation
- Less detailed feedback

#### μf (muf) - Feedback Scoring (Recommended)
```json
{
  "scoreForPareto": "muf"
}
```
- Returns score + textual feedback
- Better optimization quality
- More detailed insights

### Budget Accounting

#### Include Judge Calls in Budget
```json
{
  "mufCosts": true
}
```
- Judge calls count toward budget
- More accurate budget tracking
- Higher total cost

#### Exclude Judge Calls from Budget
```json
{
  "mufCosts": false
}
```
- Judge calls don't count toward budget
- More optimization iterations
- Separate cost tracking needed

## 🧩 Modular System Configuration

### Basic Modular Configuration
```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 150,
  "minibatchSize": 3,
  "paretoSize": 6,
  "holdoutSize": 2,
  "crossoverProb": 0.3,
  "rubric": "Correctness, clarity, safety, and helpfulness."
}
```

### Advanced Modular Configuration
```json
{
  "actorModel": "gpt-4",
  "judgeModel": "gpt-4",
  "budget": 300,
  "minibatchSize": 4,
  "paretoSize": 10,
  "holdoutSize": 4,
  "epsilonHoldout": 0.01,
  "crossoverProb": 0.4,
  "rubric": "Correctness, clarity, safety, helpfulness, and module coherence.",
  "actorTemperature": 0.3,
  "actorMaxTokens": 1024
}
```

## 🔧 Advanced Configuration

### Custom API Endpoints
```json
{
  "baseURL": "https://your-custom-endpoint.com/v1",
  "requestTimeoutMs": 30000
}
```

### Custom Strategies
```json
{
  "strategiesPath": "strategies/my-custom-strategies.json"
}
```

### Holdout Validation
```json
{
  "holdoutSize": 4,
  "epsilonHoldout": 0.01
}
```

## 📊 Configuration Templates

### Quick Test Template
```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 30,
  "minibatchSize": 2,
  "paretoSize": 2,
  "holdoutSize": 0,
  "crossoverProb": 0,
  "rubric": "Correctness and clarity."
}
```

### Production Template
```json
{
  "actorModel": "gpt-4",
  "judgeModel": "gpt-4",
  "budget": 200,
  "minibatchSize": 6,
  "paretoSize": 10,
  "holdoutSize": 4,
  "epsilonHoldout": 0.01,
  "crossoverProb": 0.3,
  "rubric": "Correctness, clarity, safety, helpfulness, and adherence to instructions.",
  "actorTemperature": 0.3,
  "actorMaxTokens": 1024,
  "strategiesPath": "strategies/strategies.json",
  "scoreForPareto": "muf",
  "mufCosts": true
}
```

### Cost-Optimized Template
```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 100,
  "minibatchSize": 4,
  "paretoSize": 6,
  "holdoutSize": 2,
  "epsilonHoldout": 0.02,
  "crossoverProb": 0.2,
  "rubric": "Correctness, clarity, and safety.",
  "actorTemperature": 0.4,
  "actorMaxTokens": 512,
  "mufCosts": false
}
```

## 🆘 Configuration Validation

### Common Configuration Errors

#### Budget Too Small
```json
// ❌ Error: Budget must be at least 10
{
  "budget": 5
}

// ✅ Solution: Increase budget
{
  "budget": 50
}
```

#### Impossible Data Split
```json
// ❌ Error: Data split impossible
{
  "paretoSize": 8,
  "holdoutSize": 4,
  "minibatchSize": 4
}
// Total prompts: 10, but paretoSize + holdoutSize = 12

// ✅ Solution: Reduce sizes
{
  "paretoSize": 4,
  "holdoutSize": 2,
  "minibatchSize": 4
}
```

#### Minibatch Too Large
```json
// ❌ Error: Minibatch size too large
{
  "paretoSize": 8,
  "holdoutSize": 2,
  "minibatchSize": 6
}
// Available feedback prompts: 0, but minibatchSize = 6

// ✅ Solution: Reduce minibatch size
{
  "paretoSize": 8,
  "holdoutSize": 2,
  "minibatchSize": 2
}
```

## 📋 Configuration Best Practices

### 1. Start Simple
- Begin with basic configuration
- Add complexity gradually
- Test with small budgets first

### 2. Match Budget to Goals
- Quick tests: 20-50 budget
- Moderate optimization: 50-100 budget
- Thorough optimization: 100-200 budget

### 3. Choose Appropriate Models
- Cost-effective: gpt-5-mini
- High quality: gpt-4
- Mixed approach: gpt-5-mini for execution, gpt-4 for evaluation

### 4. Design Good Rubrics
- Be specific about evaluation criteria
- Include safety and quality requirements
- Match rubric to your use case

### 5. Use Holdout Validation
- Reserve some data for validation
- Set appropriate epsilon thresholds
- Monitor for overfitting

### 6. Optimize for Your Domain
- Adjust crossover probability for modular systems
- Choose appropriate minibatch sizes
- Consider domain-specific requirements

---

**Ready to configure? Check out the [CLI Reference](cli-reference.md) for command-line usage!**
