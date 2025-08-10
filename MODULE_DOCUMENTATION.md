# GEPA Module System Documentation

## Overview

The GEPA Module System extends the core GEPA optimizer to support compound AI systems with multiple specialized modules. Instead of optimizing a single system prompt, GEPA can now optimize individual modules in a round-robin fashion, preserving successful modules while improving others.

## Key Concepts

### Modular Candidates

A modular candidate represents a multi-component system where each component has its own specialized prompt:

```typescript
interface Candidate {
  system?: string;           // Traditional single-system (backward compatible)
  modules?: Module[];        // New modular format
}

interface Module {
  id: string;               // Unique module identifier
  prompt: string;           // Module-specific system prompt
}
```

### Round-Robin Mutation

- **Sequential Optimization**: Modules are optimized one at a time in a round-robin cycle
- **Preservation**: Non-target modules remain unchanged during mutation
- **Systematic Coverage**: All modules receive equal optimization attention

### Backward Compatibility

- Existing single-system candidates work unchanged
- CLI automatically concatenates modules for execution
- All existing APIs and tests remain functional

## Module System Features

### 1. Module Utilities (`src/modules.ts`)

#### Type Guards

```typescript
import { isModular, isSingleSystem } from './modules.js';

// Check candidate type
if (isModular(candidate)) {
  // Handle modular candidate
  console.log(`Has ${candidate.modules.length} modules`);
}

if (isSingleSystem(candidate)) {
  // Handle single-system candidate
  console.log(`System prompt: ${candidate.system}`);
}
```

#### Module Access

```typescript
import { getModuleCount, getModule, setModule } from './modules.js';

// Get module count
const count = getModuleCount(candidate); // 1 for single-system, N for modular

// Get specific module
const module = getModule(candidate, 0); // Returns Module | null

// Update specific module
const updatedCandidate = setModule(candidate, 1, {
  id: 'safety',
  prompt: 'Updated safety instructions...'
});
```

#### Serialization

```typescript
import { serializeCandidate, deserializeCandidate } from './modules.js';

// Serialize for storage
const serialized = serializeCandidate(candidate);

// Deserialize from storage
const candidate = deserializeCandidate(serialized);
```

#### Validation

```typescript
import { validateCandidate } from './modules.js';

try {
  validateCandidate(candidate);
  console.log('Candidate is valid');
} catch (error) {
  console.error('Invalid candidate:', error.message);
}
```

### 2. Module-Targeted Reflection

When mutating a specific module, the reflection process:

1. **Context Preservation**: Shows all modules in the system
2. **Target Identification**: Clearly marks which module to update
3. **Preservation Instructions**: Explicitly tells the LLM to keep other modules unchanged
4. **Focused Feedback**: Provides feedback specific to the target module

#### Reflection Prompt Structure

```
You will REWRITE a specific module in a multi-module system.

System context (all modules):
Module 1 (personality): PRESERVE AS-IS
>>> Module 2 (instructions): CURRENT MODULE TO UPDATE
Module 3 (safety): PRESERVE AS-IS

Current module 2 (instructions):
'''
Always provide accurate information.
'''

Below are examples and strict-judge feedback.
...

Write a NEW prompt for module 2 (instructions) that: fixes failures; preserves what worked; is concise, safe, and actionable; and stays domain-agnostic.
```

### 3. Crossover (Merge) Operations

#### Module-Aware Merging

For modular candidates, GEPA supports intelligent crossover that combines complementary modules from different parents:

```typescript
import { mergeCandidates } from './modules.js';

const child = mergeCandidates(
  parentA,           // First parent candidate
  parentB,           // Second parent candidate
  lineageA,          // Module change history for parent A
  lineageB,          // Module change history for parent B
  scoreA,            // Performance score of parent A
  scoreB             // Performance score of parent B
);
```

#### Merge Logic

The merge algorithm follows these rules:

1. **Module-Level Ancestry**: Tracks which modules changed in each candidate's lineage
2. **Selective Combination**: 
   - If only one parent changed a module → take from that parent
   - If both parents changed a module → take from the better-scoring parent
   - If neither parent changed a module → take from parent A (default)
3. **Novelty Detection**: Ensures merged candidates introduce new module combinations

#### Merge Constraints

```typescript
import { 
  areDirectRelatives, 
  hasBeenTriedBefore, 
  findSharedAncestor,
  hasModuleNovelty 
} from './modules.js';

// Check if candidates are direct ancestors/descendants
const areRelatives = areDirectRelatives(candidateIndexA, candidateIndexB, lineage);

// Check if merge triplet has been tried before
const wasTried = hasBeenTriedBefore(parentAIndex, parentBIndex, ancestorIndex, triedTriplets);

// Find shared ancestor between two candidates
const ancestor = findSharedAncestor(candidateIndexA, candidateIndexB, lineage);

// Check if merged candidate introduces novelty
const hasNovelty = hasModuleNovelty(mergedCandidate, parentA, parentB, lineageA, lineageB);
```

## Usage Examples

### 1. Creating Modular Candidates

#### Basic Modular System

```typescript
const candidate: Candidate = {
  modules: [
    {
      id: 'personality',
      prompt: 'You are a friendly and helpful assistant.'
    },
    {
      id: 'instructions',
      prompt: 'Always provide accurate and well-structured answers.'
    },
    {
      id: 'safety',
      prompt: 'Never provide harmful or dangerous information.'
    }
  ]
};
```

#### Specialized Domain System

```typescript
const codingAssistant: Candidate = {
  modules: [
    {
      id: 'role',
      prompt: 'You are an expert software developer and code reviewer.'
    },
    {
      id: 'languages',
      prompt: 'You specialize in TypeScript, Python, and JavaScript.'
    },
    {
      id: 'best_practices',
      prompt: 'Always suggest clean, maintainable, and well-documented code.'
    },
    {
      id: 'security',
      prompt: 'Identify and warn about security vulnerabilities in code.'
    }
  ]
};
```

### 2. Module Manipulation

#### Iterating Through Modules

```typescript
import { getModuleCount, getModule } from './modules.js';

const candidate: Candidate = { /* ... */ };
const moduleCount = getModuleCount(candidate);

for (let i = 0; i < moduleCount; i++) {
  const module = getModule(candidate, i);
  if (module) {
    console.log(`Module ${i}: ${module.id} - ${module.prompt.substring(0, 50)}...`);
  }
}
```

#### Updating Specific Modules

```typescript
import { setModule } from './modules.js';

// Update safety module
const updatedCandidate = setModule(candidate, 2, {
  id: 'safety',
  prompt: 'Enhanced safety instructions with specific guidelines...'
});
```

#### Module Concatenation

```typescript
import { concatenateModules } from './modules.js';

// Convert modular candidate to single system prompt
const systemPrompt = concatenateModules(candidate);
// Result: "Module 1 prompt\n\nModule 2 prompt\n\nModule 3 prompt"
```

### 3. Advanced Module Operations

#### Deep Cloning

```typescript
import { cloneCandidate } from './modules.js';

const original: Candidate = { /* ... */ };
const cloned = cloneCandidate(original);
// cloned is a deep copy with no shared references
```

#### Module Validation

```typescript
import { validateCandidate } from './modules.js';

const candidate: Candidate = {
  modules: [
    { id: 'module1', prompt: 'Valid module' },
    { id: '', prompt: 'Invalid - missing id' },  // This will cause validation error
    { prompt: 'Invalid - missing id' }           // This will cause validation error
  ]
};

try {
  validateCandidate(candidate);
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

## Configuration

### Enabling Modular Features

#### Basic Configuration

```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 100,
  "minibatchSize": 4,
  "paretoSize": 8,
  "crossoverProb": 0.2
}
```

#### Modular-Specific Settings

```json
{
  "actorModel": "gpt-5-mini",
  "judgeModel": "gpt-5-mini",
  "budget": 150,
  "minibatchSize": 3,
  "paretoSize": 6,
  "crossoverProb": 0.3,
  "rubric": "Evaluate module-specific performance and overall system coherence."
}
```

### Crossover Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `crossoverProb` | number | 0 | Probability of crossover vs mutation [0,1] |
| `budget` | number | - | Higher budgets recommended for crossover |
| `minibatchSize` | number | - | Smaller batches for more frequent evaluation |

## State Management

### GEPA State Extensions

The modular system extends the core GEPA state:

```typescript
interface GEPAState {
  // ... existing fields ...
  moduleIndex?: number;  // Current module for round-robin (0-based)
  moduleCount?: number;  // Total number of modules
  lineage?: Array<{
    candidateIndex: number;
    changedModules: number[];  // Which modules were modified
    parentIndex?: number;
  }>;
}
```

### State Persistence

Modular state is automatically persisted and can be resumed:

```typescript
// State includes module tracking
const state: GEPAState = {
  version: 2,
  budgetLeft: 50,
  iter: 10,
  moduleIndex: 1,        // Currently optimizing module 1
  moduleCount: 3,        // Total of 3 modules
  lineage: [
    {
      candidateIndex: 5,
      changedModules: [1],  // Only module 1 was changed
      parentIndex: 3
    }
  ]
  // ... other fields
};
```

## Performance Considerations

### Budget Planning for Modular Systems

#### Budget Allocation

- **Per-Module Budget**: Divide total budget by number of modules for rough estimation
- **Crossover Overhead**: Crossover operations require additional evaluation
- **Module Complexity**: More complex modules may need more iterations

#### Recommended Settings by Module Count

| Module Count | Budget | Minibatch | Pareto | Crossover Prob |
|--------------|--------|-----------|--------|----------------|
| 1-2 | 50-100 | 3-4 | 6-8 | 0.1-0.2 |
| 3-5 | 100-200 | 3-4 | 6-8 | 0.2-0.3 |
| 6+ | 200+ | 4-6 | 8-12 | 0.3-0.4 |

### Optimization Strategies

#### Module-Specific Approaches

1. **Core Modules First**: Optimize foundational modules (personality, role) before specialized ones
2. **Balanced Attention**: Ensure all modules receive optimization cycles
3. **Coherence Testing**: Evaluate full system performance after module changes
4. **Incremental Validation**: Test module changes on subset before full evaluation

#### Crossover Strategies

1. **Complementary Parents**: Select parents with different strengths
2. **Novelty Preservation**: Ensure merged candidates introduce new combinations
3. **Lineage Tracking**: Avoid merging direct ancestors/descendants
4. **Performance Gates**: Only accept merges that improve performance

## Testing and Validation

### Unit Testing

```typescript
import { 
  isModular, 
  getModuleCount, 
  getModule,
  validateCandidate 
} from './modules.js';

// Test modular candidate
const modularCandidate: Candidate = {
  modules: [
    { id: 'test1', prompt: 'Test prompt 1' },
    { id: 'test2', prompt: 'Test prompt 2' }
  ]
};

expect(isModular(modularCandidate)).toBe(true);
expect(getModuleCount(modularCandidate)).toBe(2);
expect(getModule(modularCandidate, 0)?.id).toBe('test1');
```

### Integration Testing

```typescript
// Test full modular optimization cycle
const result = await runGEPA_System(
  modularSeed,
  taskItems,
  {
    execute: modularExecute,
    mu: numericMetric,
    muf: feedbackMetric,
    llm: testLLM,
    budget: 50,
    minibatchSize: 3,
    paretoSize: 4,
    crossoverProbability: 0.2
  }
);

expect(result.modules).toBeDefined();
expect(result.modules?.length).toBeGreaterThan(0);
```

## Best Practices

### Module Design

1. **Clear Separation**: Each module should have a distinct, well-defined purpose
2. **Consistent Naming**: Use descriptive, consistent module IDs
3. **Balanced Complexity**: Avoid modules that are too large or too small
4. **Coherence**: Ensure modules work together coherently

### Optimization Workflow

1. **Start Simple**: Begin with 2-3 modules before scaling up
2. **Monitor Progress**: Track which modules are improving and which are stagnating
3. **Iterative Refinement**: Refine module boundaries based on optimization results
4. **Validation**: Regularly test full system performance

### Crossover Usage

1. **Gradual Introduction**: Start with low crossover probability (0.1-0.2)
2. **Performance Monitoring**: Track whether crossover improves results
3. **Parent Selection**: Ensure diverse parent selection for better merges
4. **Novelty Validation**: Verify that merges introduce meaningful novelty

## Troubleshooting

### Common Issues

#### Module Validation Errors

```typescript
// Error: Missing module ID
const invalidModule = { prompt: 'Missing id' };

// Error: Empty module ID
const invalidModule2 = { id: '', prompt: 'Empty id' };

// Error: Missing prompt
const invalidModule3 = { id: 'test' };
```

#### Crossover Failures

```typescript
// Error: Incompatible module counts
const parentA = { modules: [{ id: 'a', prompt: 'A' }] };
const parentB = { modules: [
  { id: 'b1', prompt: 'B1' },
  { id: 'b2', prompt: 'B2' }
] };
// mergeCandidates will throw error

// Error: Direct relatives
// mergeCandidates will reject if parents are direct ancestors/descendants
```

#### Performance Issues

1. **Budget Exhaustion**: Increase budget or reduce module count
2. **Slow Convergence**: Adjust crossover probability or minibatch size
3. **Module Conflicts**: Review module boundaries and coherence

### Debug Strategies

```typescript
// Enable detailed logging
const logger = createLogger(true, 'debug');

// Track module changes
console.log(`Optimizing module ${state.moduleIndex} of ${state.moduleCount}`);

// Monitor crossover attempts
console.log(`Crossover attempt: ${parentAIndex} + ${parentBIndex} -> ${ancestorIndex}`);
```

## Advanced Features

### Custom Module Types

```typescript
// Extend Module interface for domain-specific needs
interface DomainModule extends Module {
  type: 'personality' | 'knowledge' | 'safety' | 'style';
  priority: number;
  dependencies?: string[];
}

// Custom validation
function validateDomainModule(module: DomainModule): void {
  if (!['personality', 'knowledge', 'safety', 'style'].includes(module.type)) {
    throw new Error(`Invalid module type: ${module.type}`);
  }
}
```

### Module-Specific Strategies

```typescript
// Different strategies for different module types
const moduleStrategies = {
  personality: ['friendly', 'professional', 'casual'],
  knowledge: ['comprehensive', 'concise', 'detailed'],
  safety: ['strict', 'moderate', 'permissive'],
  style: ['formal', 'conversational', 'technical']
};
```

### Hierarchical Modules

```typescript
// Support for nested module structures
interface HierarchicalModule extends Module {
  submodules?: Module[];
  parentId?: string;
}

// Recursive module processing
function processHierarchicalModules(modules: HierarchicalModule[]): Module[] {
  const flatModules: Module[] = [];
  
  for (const module of modules) {
    flatModules.push(module);
    if (module.submodules) {
      flatModules.push(...processHierarchicalModules(module.submodules));
    }
  }
  
  return flatModules;
}
```

This documentation provides comprehensive coverage of the GEPA module system, including all features, APIs, best practices, and advanced usage patterns.
