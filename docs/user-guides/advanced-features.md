# Advanced Features Guide

Advanced features and techniques for maximizing GEPA (Genetic-Pareto) Prompt Evolution performance.

## 🎯 Overview

GEPA offers several advanced features that can significantly improve optimization results when used correctly. This guide covers crossover operations, strategy adaptation, holdout validation, and other advanced techniques.

## 🧬 Crossover Operations

### Understanding Crossover

Crossover is a genetic algorithm technique that combines modules from different parent candidates to create new offspring. In GEPA, crossover is particularly powerful for modular systems.

### When to Use Crossover

#### Single Systems
```json
{
  "crossoverProb": 0
}
```
- **Use case**: Simple system prompts
- **Reason**: No modules to combine
- **Performance**: Mutation-only optimization

#### Modular Systems
```json
{
  "crossoverProb": 0.2
}
```
- **Use case**: Multi-component prompts
- **Reason**: Intelligent module merging
- **Performance**: Better than mutation-only

#### Complex Modular Systems
```json
{
  "crossoverProb": 0.4
}
```
- **Use case**: Complex multi-module systems
- **Reason**: Maximum exploration
- **Performance**: Best results, higher cost

### Crossover Logic

GEPA uses intelligent crossover that considers:

1. **Module Lineage**: Which modules changed in each parent
2. **Performance History**: How well each parent performed
3. **Novelty Detection**: Ensures new combinations
4. **Ancestry Tracking**: Avoids direct relatives

### Crossover Example

```typescript
// Parent A (high performance)
{
  modules: [
    { id: "personality", prompt: "You are enthusiastic." }, // Changed
    { id: "safety", prompt: "Never provide harmful content." }, // Unchanged
    { id: "instructions", prompt: "Be concise." } // Changed
  ]
}

// Parent B (moderate performance)
{
  modules: [
    { id: "personality", prompt: "You are professional." }, // Changed
    { id: "safety", prompt: "Never provide harmful content." }, // Unchanged
    { id: "instructions", prompt: "Provide detailed answers." } // Changed
  ]
}

// Crossover Result
{
  modules: [
    { id: "personality", prompt: "You are enthusiastic." }, // From A (better)
    { id: "safety", prompt: "Never provide harmful content." }, // From A (default)
    { id: "instructions", prompt: "Provide detailed answers." } // From B (different)
  ]
}
```

## 🎰 Strategy Adaptation

### Strategy Bandit

GEPA uses a UCB1 (Upper Confidence Bound) bandit algorithm to adaptively select optimization strategies.

### Available Strategies

#### Polya 4-Step
```json
{
  "id": "polya-4step",
  "hint": "Apply Polya's four-step problem-solving method: understand, plan, execute, review."
}
```

#### First Principles
```json
{
  "id": "first-principles",
  "hint": "Break down problems into fundamental principles and build solutions from scratch."
}
```

#### Analogical Reasoning
```json
{
  "id": "analogical-reasoning",
  "hint": "Use analogies and comparisons to explain complex concepts."
}
```

#### Systematic Analysis
```json
{
  "id": "systematic-analysis",
  "hint": "Apply systematic, step-by-step analysis to problems."
}
```

### Strategy Selection Process

1. **Exploration**: Try different strategies to discover effectiveness
2. **Exploitation**: Focus on strategies that work well
3. **Adaptation**: Switch strategies when performance plateaus
4. **Learning**: Track strategy effectiveness over time

### Custom Strategies

Create custom strategies for your domain:

```json
// strategies/custom-strategies.json
[
  {
    "id": "medical-safety",
    "hint": "Prioritize patient safety and evidence-based medical information."
  },
  {
    "id": "legal-precision",
    "hint": "Use precise legal terminology and cite relevant statutes."
  },
  {
    "id": "educational-engagement",
    "hint": "Make learning engaging with examples and interactive elements."
  }
]
```

Reference in configuration:
```json
{
  "strategiesPath": "strategies/custom-strategies.json"
}
```

## 🔍 Holdout Validation

### Purpose

Holdout validation prevents overfitting by reserving some data for final validation.

### Configuration

```json
{
  "holdoutSize": 4,
  "epsilonHoldout": 0.01
}
```

### How It Works

1. **Data Split**: Reserve `holdoutSize` prompts for validation
2. **Optimization**: Optimize using remaining data
3. **Validation**: Test improvements on holdout set
4. **Acceptance**: Only accept if improvement ≥ `epsilonHoldout`

### Holdout Example

```typescript
// Training data (used for optimization)
const trainingPrompts = [
  { id: "train-1", user: "What is 2+2?" },
  { id: "train-2", user: "What is the capital of France?" },
  { id: "train-3", user: "How do I install Python?" },
  { id: "train-4", user: "What is machine learning?" },
  { id: "train-5", user: "How do I cook pasta?" },
  { id: "train-6", user: "What is the weather like?" }
];

// Holdout data (used for validation)
const holdoutPrompts = [
  { id: "holdout-1", user: "What is quantum computing?" },
  { id: "holdout-2", user: "How do I write a resume?" },
  { id: "holdout-3", user: "What are the benefits of exercise?" },
  { id: "holdout-4", user: "How do I learn a new language?" }
];
```

### Holdout Thresholds

#### Conservative (0.01)
```json
{
  "epsilonHoldout": 0.01
}
```
- **Use case**: High-quality optimization
- **Acceptance**: Only significant improvements
- **Risk**: May reject good candidates

#### Moderate (0.02)
```json
{
  "epsilonHoldout": 0.02
}
```
- **Use case**: Standard optimization
- **Acceptance**: Moderate improvements
- **Risk**: Balanced approach

#### Aggressive (0.05)
```json
{
  "epsilonHoldout": 0.05
}
```
- **Use case**: Quick optimization
- **Acceptance**: Any improvement
- **Risk**: May accept overfitting

## 📊 Performance Monitoring

### Real-Time Statistics

When logging is enabled, GEPA provides detailed statistics:

```
📈 Iteration 1: Score=0.567 (+8.4%) | Accepted=true | Operation=mutation | Budget=85/100
📈 Iteration 2: Score=0.589 (+12.6%) | Accepted=true | Operation=crossover | Budget=70/100
📈 Iteration 3: Score=0.601 (+14.9%) | Accepted=false | Operation=mutation | Budget=65/100
```

### Key Metrics

#### Acceptance Rate
- **Target**: 30-70%
- **Too Low**: Strategies may be too aggressive
- **Too High**: May not be exploring enough

#### Improvement Rate
- **Early**: 10-30% per iteration
- **Mid**: 5-15% per iteration
- **Late**: 1-5% per iteration

#### Budget Efficiency
- **Score per Budget Unit**: Higher is better
- **Target**: >0.005 for good optimization
- **Excellent**: >0.01

### Performance Analysis

#### Early Optimization
```
📊 PERFORMANCE STATISTICS
├─ Initial Score: 0.523
├─ Current Score: 0.678
├─ Improvement: +29.6%
├─ Iterations: 8
├─ Acceptance Rate: 75.0%
└─ Budget Used: 40/100
```

#### Mid Optimization
```
📊 PERFORMANCE STATISTICS
├─ Initial Score: 0.523
├─ Current Score: 0.745
├─ Improvement: +42.4%
├─ Iterations: 15
├─ Acceptance Rate: 53.3%
└─ Budget Used: 75/100
```

#### Late Optimization
```
📊 PERFORMANCE STATISTICS
├─ Initial Score: 0.523
├─ Current Score: 0.789
├─ Improvement: +50.9%
├─ Iterations: 20
├─ Acceptance Rate: 35.0%
└─ Budget Used: 95/100
```

## 🔄 Advanced Optimization Techniques

### Multi-Objective Optimization

GEPA maintains a Pareto frontier of candidates that excel in different objectives:

```typescript
// Objective 1: Accuracy
const accuracyScores = [0.8, 0.9, 0.7, 0.85];

// Objective 2: Conciseness
const concisenessScores = [0.6, 0.5, 0.8, 0.7];

// Pareto frontier: Candidates that aren't dominated
const paretoCandidates = [1, 3]; // Candidates 1 and 3
```

### Frequency-Weighted Selection

GEPA selects parents using frequency-weighted sampling:

```typescript
// More frequent candidates have higher selection probability
const selectionWeights = [
  0.1, // Candidate 0: 10% chance
  0.3, // Candidate 1: 30% chance
  0.2, // Candidate 2: 20% chance
  0.4  // Candidate 3: 40% chance
];
```

### Trace-Aware Reflection

GEPA includes execution traces in reflection prompts:

```typescript
const reflectionPrompt = `
Current Prompt: "${currentPrompt}"

Execution Trace:
- System used: "${systemPrompt}"
- Processing time: 2.3s
- Tokens used: 150
- Confidence: 0.85

Examples and feedback:
${examples}

Strategy: ${strategyHint}

Write an improved prompt that addresses the feedback.
`;
```

## 🧪 Advanced Testing

### A/B Testing

Compare different configurations:

```bash
# Test A: High crossover probability
npx gepa-spo --input input.json --config config-high-crossover.json --log

# Test B: Low crossover probability
npx gepa-spo --input input.json --config config-low-crossover.json --log

# Compare results
diff runs/test-a/statistics.json runs/test-b/statistics.json
```

### Cross-Validation

Use different data splits:

```json
// config-fold-1.json
{
  "paretoSize": 6,
  "holdoutSize": 2,
  "minibatchSize": 4
}

// config-fold-2.json
{
  "paretoSize": 4,
  "holdoutSize": 4,
  "minibatchSize": 4
}
```

### Performance Benchmarking

Create performance benchmarks:

```typescript
const benchmarks = {
  baseline: {
    score: 0.523,
    cost: 0,
    time: 0
  },
  optimized: {
    score: 0.789,
    cost: 85,
    time: 1200 // seconds
  },
  improvement: {
    score: "+50.9%",
    costPerUnit: 0.0031,
    efficiency: 0.0093
  }
};
```

## 🔧 Advanced Configuration

### Custom API Endpoints

Use with OpenAI-compatible APIs:

```json
{
  "baseURL": "https://your-custom-endpoint.com/v1",
  "requestTimeoutMs": 30000,
  "actorModel": "your-model-name",
  "judgeModel": "your-model-name"
}
```

### Advanced Model Settings

```json
{
  "actorModel": "gpt-4",
  "judgeModel": "gpt-4",
  "actorTemperature": 0.3,
  "actorMaxTokens": 1024,
  "requestTimeoutMs": 60000
}
```

### Custom Evaluation Functions

For programmatic use:

```typescript
const customMuf = async ({ item, output, traces }) => {
  // Custom evaluation logic
  const score = await evaluateCustom(output, item);
  const feedback = await generateFeedback(output, item);
  
  return {
    score,
    feedbackText: feedback
  };
};
```

## 📈 Performance Optimization

### Budget Optimization

#### Cost-Effective Approach
```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "mufCosts": false,
  "budget": 100
}
```

#### Quality-Focused Approach
```json
{
  "actorModel": "gpt-4",
  "judgeModel": "gpt-4",
  "mufCosts": true,
  "budget": 200
}
```

### Speed Optimization

#### Fast Iterations
```json
{
  "minibatchSize": 2,
  "paretoSize": 4,
  "holdoutSize": 0
}
```

#### Comprehensive Evaluation
```json
{
  "minibatchSize": 6,
  "paretoSize": 10,
  "holdoutSize": 4
}
```

### Quality Optimization

#### Conservative Settings
```json
{
  "epsilonHoldout": 0.01,
  "crossoverProb": 0.1,
  "actorTemperature": 0.3
}
```

#### Aggressive Settings
```json
{
  "epsilonHoldout": 0.05,
  "crossoverProb": 0.4,
  "actorTemperature": 0.5
}
```

## 🆘 Advanced Troubleshooting

### Performance Plateaus

**Problem**: No improvement for several iterations

**Solutions**:
1. **Increase budget**: More iterations needed
2. **Adjust strategies**: Try different optimization approaches
3. **Modify rubric**: Make evaluation criteria more specific
4. **Check data quality**: Ensure diverse, challenging prompts

### Overfitting Detection

**Problem**: High training performance, low holdout performance

**Solutions**:
1. **Increase holdout size**: More validation data
2. **Lower epsilon**: Stricter acceptance criteria
3. **Add regularization**: More diverse training data
4. **Reduce complexity**: Simpler prompt structure

### Strategy Ineffectiveness

**Problem**: Low acceptance rate or poor improvement

**Solutions**:
1. **Review strategies**: Ensure they're appropriate for your domain
2. **Custom strategies**: Create domain-specific strategies
3. **Adjust parameters**: Modify crossover probability, minibatch size
4. **Check data**: Ensure prompts are diverse and challenging

## 📋 Advanced Best Practices

### 1. Iterative Refinement
- Start with simple configurations
- Gradually add complexity
- Monitor performance metrics
- Adjust based on results

### 2. Domain Adaptation
- Create custom strategies for your domain
- Use domain-specific evaluation criteria
- Include domain-relevant test cases
- Monitor domain-specific metrics

### 3. Performance Monitoring
- Track key metrics over time
- Set performance targets
- Monitor for overfitting
- Adjust configuration based on results

### 4. Cost Management
- Balance quality vs cost
- Use appropriate models for your needs
- Monitor budget usage
- Optimize for efficiency

### 5. Validation Strategy
- Use holdout validation
- Set appropriate thresholds
- Monitor validation performance
- Prevent overfitting

---

**Ready to explore advanced features? Check out the [API Reference](../developer-guides/api-reference.md) for programmatic usage!**
