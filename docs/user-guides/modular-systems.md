# Modular Systems Guide

GEPA supports optimization of **modular prompt systems** - multi-component prompts where each component has a specialized role. This guide covers how to create, configure, and optimize modular systems.

## 🧩 What are Modular Systems?

Modular systems break down a single system prompt into specialized components:

```json
{
  "modules": [
    { "id": "personality", "prompt": "You are friendly and helpful." },
    { "id": "safety", "prompt": "Never provide harmful content." },
    { "id": "instructions", "prompt": "Always provide accurate information." }
  ],
  "prompts": [...]
}
```

Instead of optimizing one large prompt, GEPA optimizes each module individually while preserving the overall system structure.

## 🎯 Benefits of Modular Systems

### 1. **Specialized Optimization**
- Each module can be optimized for its specific purpose
- Personality modules focus on tone and style
- Safety modules focus on content filtering
- Instruction modules focus on task performance

### 2. **Better Crossover**
- Modules can be intelligently combined from different parents
- Complementary strengths can be merged
- Novel combinations can be discovered

### 3. **Easier Maintenance**
- Individual modules can be updated without affecting others
- Clear separation of concerns
- Better debugging and analysis

### 4. **Reusability**
- Modules can be reused across different systems
- Standard modules can be shared and improved
- Component-based development

## 📝 Creating Modular Systems

### Basic Structure

```json
{
  "modules": [
    {
      "id": "personality",
      "prompt": "You are a friendly and helpful assistant."
    },
    {
      "id": "safety", 
      "prompt": "Never provide harmful, dangerous, or illegal content."
    },
    {
      "id": "instructions",
      "prompt": "Provide accurate, concise answers to user questions."
    }
  ],
  "prompts": [
    {
      "id": "math-1",
      "user": "What is 2 + 2?"
    },
    {
      "id": "fact-1",
      "user": "What is the capital of France?"
    }
  ]
}
```

### Module Design Principles

#### 1. **Clear Responsibilities**
Each module should have a single, well-defined purpose:

```json
{
  "modules": [
    {
      "id": "role",
      "prompt": "You are a math tutor specializing in algebra and calculus."
    },
    {
      "id": "style",
      "prompt": "Use clear, step-by-step explanations with examples."
    },
    {
      "id": "safety",
      "prompt": "Never provide solutions to homework problems directly."
    }
  ]
}
```

#### 2. **Independent Functionality**
Modules should work independently when possible:

```json
{
  "modules": [
    {
      "id": "personality",
      "prompt": "You are enthusiastic and encouraging."
    },
    {
      "id": "formatting",
      "prompt": "Use bullet points and numbered lists for clarity."
    }
  ]
}
```

#### 3. **Consistent Interface**
Modules should have consistent input/output expectations:

```json
{
  "modules": [
    {
      "id": "input_processing",
      "prompt": "Always clarify ambiguous questions before answering."
    },
    {
      "id": "output_formatting",
      "prompt": "Structure responses with clear headings and sections."
    }
  ]
}
```

## ⚙️ Configuration for Modular Systems

### Recommended Settings

```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 150,
  "minibatchSize": 3,
  "paretoSize": 6,
  "holdoutSize": 2,
  "crossoverProb": 0.3,
  "rubric": "Correctness, clarity, safety, and helpfulness.",
  "epsilonHoldout": 0.02
}
```

### Key Configuration Differences

| Setting | Single System | Modular System | Reason |
|---------|---------------|----------------|---------|
| `budget` | 50-100 | 100-200 | More modules to optimize |
| `crossoverProb` | 0-0.1 | 0.2-0.4 | Crossover is more effective |
| `minibatchSize` | 4-6 | 3-4 | Smaller batches for module focus |
| `paretoSize` | 4-8 | 6-10 | More diverse module combinations |

## 🔄 Optimization Process

### Round-Robin Mutation

GEPA optimizes modules in a round-robin fashion:

1. **Module Selection**: Choose next module in sequence
2. **Context Preservation**: Show all modules to maintain context
3. **Targeted Optimization**: Focus on improving the selected module
4. **Preservation Instructions**: Explicitly tell LLM to keep other modules unchanged

### Example Optimization Cycle

```
Iteration 1: Optimize personality module
Iteration 2: Optimize safety module  
Iteration 3: Optimize instructions module
Iteration 4: Back to personality module
...
```

### Reflection Prompt Structure

When optimizing a specific module, GEPA uses prompts like:

```
You will REWRITE a specific module in a multi-module system.

System context (all modules):
Module 1 (personality): PRESERVE AS-IS
>>> Module 2 (safety): CURRENT MODULE TO UPDATE
Module 3 (instructions): PRESERVE AS-IS

Current module 2 (safety):
'''
Never provide harmful content.
'''

Below are examples and strict-judge feedback.
...

Write a NEW prompt for module 2 (safety) that: fixes failures; preserves what worked; is concise, safe, and actionable; and stays domain-agnostic.
```

## 🧬 Crossover Operations

### Intelligent Module Merging

GEPA performs system-aware crossover:

1. **Lineage Tracking**: Track which modules changed in each candidate
2. **Module Selection**: Choose modules based on change history and performance
3. **Novelty Detection**: Ensure merged candidates introduce new combinations

### Crossover Logic

```typescript
// Module selection rules
if (changedInA && !changedInB) {
  // Only parent A changed this module - take from A
  selectedModule = parentA.modules[moduleIndex];
} else if (changedInB && !changedInA) {
  // Only parent B changed this module - take from B
  selectedModule = parentB.modules[moduleIndex];
} else if (changedInA && changedInB) {
  // Both parents changed this module - take from better scoring parent
  selectedModule = scoreA >= scoreB ? parentA.modules[moduleIndex] : parentB.modules[moduleIndex];
} else {
  // Neither parent changed this module - take from parent A (default)
  selectedModule = parentA.modules[moduleIndex];
}
```

### Crossover Constraints

GEPA enforces several constraints during crossover:

1. **No Direct Relatives**: Won't merge direct ancestors/descendants
2. **Novelty Requirement**: Must introduce new module combinations
3. **Performance Gates**: Only accept merges that improve performance
4. **Triplet Tracking**: Avoid repeating previously tried combinations

## 📊 Performance Considerations

### Budget Planning

For modular systems, budget requirements scale with module count:

| Module Count | Recommended Budget | Minibatch Size | Pareto Size |
|--------------|-------------------|----------------|-------------|
| 1-2 | 50-100 | 3-4 | 4-6 |
| 3-5 | 100-200 | 3-4 | 6-8 |
| 6+ | 200+ | 4-6 | 8-12 |

### Optimization Strategies

#### 1. **Core Modules First**
Optimize foundational modules before specialized ones:
- Personality and role modules
- Safety and compliance modules
- Core instruction modules

#### 2. **Balanced Attention**
Ensure all modules receive optimization cycles:
- Round-robin scheduling
- Performance monitoring per module
- Strategy adaptation based on module performance

#### 3. **Coherence Testing**
Evaluate full system performance after module changes:
- End-to-end testing
- Cross-module interaction validation
- System-level performance metrics

## 🚀 Advanced Techniques

### Custom Module Types

Create specialized module types for your domain:

```json
{
  "modules": [
    {
      "id": "domain_knowledge",
      "prompt": "You are an expert in machine learning and AI."
    },
    {
      "id": "teaching_style",
      "prompt": "Explain concepts using analogies and examples."
    },
    {
      "id": "interaction_pattern",
      "prompt": "Ask clarifying questions when user input is ambiguous."
    }
  ]
}
```

### Module Dependencies

Handle modules that depend on each other:

```json
{
  "modules": [
    {
      "id": "context_analyzer",
      "prompt": "Analyze user context and determine response type."
    },
    {
      "id": "response_generator",
      "prompt": "Generate responses based on context analysis."
    }
  ]
}
```

### Dynamic Module Selection

Use conditional logic in modules:

```json
{
  "modules": [
    {
      "id": "adaptive_style",
      "prompt": "If the user asks technical questions, be formal. If casual questions, be friendly."
    }
  ]
}
```

## 📁 Example Configurations

### Math Tutor System

```json
{
  "modules": [
    {
      "id": "role",
      "prompt": "You are a patient math tutor with 20 years of teaching experience."
    },
    {
      "id": "teaching_method",
      "prompt": "Use the Socratic method - ask guiding questions rather than giving direct answers."
    },
    {
      "id": "safety",
      "prompt": "Never provide complete homework solutions. Guide students to find answers themselves."
    },
    {
      "id": "formatting",
      "prompt": "Use clear mathematical notation and step-by-step explanations."
    }
  ]
}
```

### Customer Support System

```json
{
  "modules": [
    {
      "id": "personality",
      "prompt": "You are a friendly, professional customer support representative."
    },
    {
      "id": "empathy",
      "prompt": "Acknowledge customer concerns and show understanding of their situation."
    },
    {
      "id": "problem_solving",
      "prompt": "Use systematic troubleshooting to identify and resolve issues."
    },
    {
      "id": "escalation",
      "prompt": "Know when to escalate complex issues to human support."
    }
  ]
}
```

## 🧪 Testing Modular Systems

### Module-Level Testing

Test individual modules:

```typescript
// Test personality module
const personalityModule = { id: "personality", prompt: "You are friendly." };
const result = await testModule(personalityModule, testCases);

// Test safety module
const safetyModule = { id: "safety", prompt: "Never provide harmful content." };
const safetyResult = await testModule(safetyModule, safetyTestCases);
```

### System-Level Testing

Test the complete modular system:

```typescript
const modularSystem = {
  modules: [personalityModule, safetyModule, instructionModule]
};
const systemResult = await testSystem(modularSystem, comprehensiveTestCases);
```

### Cross-Module Interaction Testing

Test how modules work together:

```typescript
// Test personality + safety interaction
const personalitySafetyTest = await testModuleInteraction(
  [personalityModule, safetyModule],
  edgeCaseTestCases
);
```

## 🆘 Troubleshooting

### Common Issues

**Module Conflicts**
- **Problem**: Modules contradict each other
- **Solution**: Review module responsibilities and ensure consistency

**Performance Degradation**
- **Problem**: Adding modules reduces overall performance
- **Solution**: Check module dependencies and optimize module order

**Crossover Ineffectiveness**
- **Problem**: Crossover operations don't improve performance
- **Solution**: Increase crossover probability and check module independence

### Best Practices

1. **Start Simple**: Begin with 2-3 modules, add complexity gradually
2. **Clear Boundaries**: Ensure each module has a distinct, non-overlapping purpose
3. **Test Independently**: Verify each module works well on its own
4. **Monitor Interactions**: Watch for conflicts between modules
5. **Iterate Gradually**: Make small changes and test thoroughly

---

**Ready to build modular systems? Check out the [Examples Directory](../examples/README.md) for working configurations!**
