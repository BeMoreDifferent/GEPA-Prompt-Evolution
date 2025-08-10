# Basic Concepts

Understanding the fundamental concepts behind GEPA (Genetic-Pareto) will help you use it more effectively.

## 🧬 What is GEPA?

GEPA (Genetic-Pareto) is a **prompt optimization method** that uses natural-language reflection on full system trajectories to evolve system prompts. Unlike traditional methods that collapse to a single "best" prompt, GEPA maintains a **Pareto frontier** of high-performing candidates.

### Key Principles

1. **Language-Native Credit Assignment**: Uses textual execution traces rather than just scalar rewards
2. **Pareto Frontier Maintenance**: Keeps diverse, high-performing candidates instead of a single best
3. **Sample-Efficient Adaptation**: Achieves large quality gains with few rollouts
4. **System-Aware Evolution**: Optimizes compound AI systems with multiple components

## 🎯 Core Concepts

### Compound AI System

A **compound AI system** consists of:
- **Modules**: Individual prompt components (e.g., personality, safety, instructions)
- **Control Flow**: How modules interact and execute
- **System Prompt**: The complete prompt used for execution

```typescript
// Single-system example
const system = "You are a helpful assistant. Be concise and accurate.";

// Modular system example
const modules = [
  { id: "personality", prompt: "You are friendly and helpful." },
  { id: "safety", prompt: "Never provide harmful content." },
  { id: "instructions", prompt: "Always provide accurate information." }
];
```

### Pareto Frontier

The **Pareto frontier** is a set of candidates where no candidate dominates another across all objectives. This allows GEPA to maintain diverse strategies rather than converging to a single solution.

**Pareto Dominance**: Candidate A dominates Candidate B if A is at least as good as B on all objectives and strictly better on at least one.

### Data Splitting

GEPA splits your training data into three sets:

1. **Pareto Set**: Used for multi-objective evaluation and candidate ranking
2. **Feedback Set**: Used for minibatch evaluation during optimization
3. **Holdout Set**: Used for final validation and overfitting prevention

```
Total Data: [Pareto] [Feedback] [Holdout]
```

## 🔄 Optimization Process

### 1. Initialization
- Evaluate the seed system on the Pareto set
- Initialize the candidate pool with the seed
- Set up strategy bandit for adaptive strategy selection

### 2. Main Loop
For each iteration until budget exhaustion:

1. **Parent Selection**: Choose parent from Pareto frontier using frequency-weighted sampling
2. **Minibatch Evaluation**: Evaluate parent on feedback set items
3. **Child Generation**: 
   - **Mutation**: Use reflection to improve specific modules
   - **Crossover**: Merge complementary modules from different parents
4. **Acceptance**: Accept child if it improves performance
5. **Pareto Update**: Evaluate accepted children on Pareto set

### 3. Strategy Adaptation
- Use UCB1 bandit to select optimization strategies
- Re-prefilter strategies when performance plateaus
- Track strategy effectiveness and adapt accordingly

## 🧩 Key Components

### Reflection-Based Mutation

GEPA uses **natural-language reflection** to mutate prompts:

```
Current Prompt: "You are a helpful assistant."
Examples: [user/assistant/feedback pairs with traces]
Strategy Hint: "Apply first-principles thinking"

→ LLM generates improved prompt based on examples and strategy
```

### System-Aware Crossover

For modular systems, GEPA performs **intelligent crossover**:

1. **Lineage Tracking**: Track which modules changed in each candidate
2. **Module Selection**: Choose modules based on change history and performance
3. **Novelty Detection**: Ensure merged candidates introduce new combinations

### Strategy Bandit

GEPA uses a **UCB1 bandit** to adaptively select optimization strategies:

- **Exploration**: Try different strategies to discover effective approaches
- **Exploitation**: Focus on strategies that have shown good performance
- **Adaptation**: Switch strategies when performance plateaus

## 📊 Performance Metrics

### Scoring Functions

GEPA supports two scoring approaches:

1. **μ (mu)**: Simple numeric scoring function
2. **μf (muf)**: Feedback function that returns score + textual feedback

```typescript
// Simple scoring
const mu = (output: string) => 0.8;

// Feedback scoring
const muf = async ({ item, output }) => ({
  score: 0.8,
  feedbackText: "Good response, but could be more concise"
});
```

### Multi-Objective Evaluation

GEPA evaluates candidates across multiple objectives:
- **Performance**: How well the system performs on tasks
- **Diversity**: How different candidates are from each other
- **Robustness**: How consistent performance is across different inputs

## 🔧 Configuration Concepts

### Budget Management

- **Total Budget**: Maximum LLM calls allowed
- **Minibatch Size**: Number of feedback items evaluated per iteration
- **Pareto Size**: Number of items used for multi-objective evaluation
- **Holdout Size**: Number of items reserved for validation

### Optimization Parameters

- **Crossover Probability**: Likelihood of using crossover vs mutation
- **Strategy Threshold**: Minimum score for strategy acceptance
- **Holdout Epsilon**: Minimum improvement required for holdout acceptance

## 🎯 When to Use GEPA

### Ideal Use Cases

✅ **Compound AI Systems**: Multi-component prompts with specialized modules
✅ **Sample Efficiency**: When LLM calls are expensive or limited
✅ **Multi-Objective Optimization**: When you need to balance multiple criteria
✅ **Robustness Requirements**: When you need consistent performance across inputs

### Alternative Approaches

❌ **Simple Prompts**: For basic single-system prompts, simpler methods may suffice
❌ **Unlimited Budget**: If cost is not a concern, exhaustive search might be better
❌ **Single Objective**: If you only care about one metric, gradient-based methods might work

## 🚀 Advanced Concepts

### Trace-Aware Reflection

GEPA includes execution traces in reflection prompts:
- **System Context**: What prompt was used
- **Execution Steps**: How the system processed the input
- **Timing Information**: Performance characteristics
- **Metadata**: Additional context about the task

### Modular Optimization

For modular systems, GEPA uses:
- **Round-Robin Mutation**: Optimize modules one at a time
- **Module-Level Ancestry**: Track which modules changed in each candidate
- **Selective Crossover**: Combine complementary modules from different parents

### Strategy Adaptation

GEPA adapts its optimization strategy:
- **Performance Monitoring**: Track improvement rates
- **Strategy Switching**: Change strategies when performance plateaus
- **Bandit Learning**: Learn which strategies work best for your domain

---

**Ready to dive deeper? Check out the [Technical Documentation](../technical/algorithm.md) for detailed algorithm explanations.**
