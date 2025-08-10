# Modular Round-Robin Mutation in GEPA

This document describes the modular round-robin mutation feature that allows GEPA to optimize multi-module system prompts.

## Overview

The modular functionality extends GEPA to support compound AI systems with multiple modules, where each module has its own prompt. Instead of mutating a single system prompt, GEPA now cycles through modules in a round-robin fashion, mutating one module at a time while preserving the others.

## Key Features

### 1. Modular Candidates

Candidates can now be either:
- **Single-system**: Traditional `{ system: string }` format (backward compatible)
- **Modular**: `{ modules: Array<{ id: string, prompt: string }> }` format

### 2. Round-Robin Mutation

- GEPA tracks the current module index in the state
- Each iteration mutates only the current module
- Module index cycles through all modules (0, 1, 2, ..., n-1, 0, 1, ...)
- Other modules remain unchanged during mutation

### 3. Backward Compatibility

- Existing single-system candidates continue to work unchanged
- CLI concatenates modules for execution, maintaining compatibility
- All existing tests pass without modification

## Usage

### Single-System (Traditional)

```typescript
const candidate: Candidate = {
  system: "You are a helpful assistant."
};
```

### Modular System

```typescript
const candidate: Candidate = {
  modules: [
    { id: "personality", prompt: "You are friendly and helpful." },
    { id: "instructions", prompt: "Always provide accurate information." },
    { id: "safety", prompt: "Never provide harmful content." }
  ]
};
```

### CLI Usage

The CLI automatically handles both formats:

```bash
# Single-system (existing format)
pnpm start --input examples/input.json --config examples/config.json

# Modular system (same command, different input format)
pnpm start --input examples/modular-example.json --config examples/config.json
```

## Implementation Details

### Module Utilities (`src/modules.ts`)

- `isModular(candidate)`: Check if candidate has modules
- `isSingleSystem(candidate)`: Check if candidate has system
- `getModuleCount(candidate)`: Get number of modules
- `getModule(candidate, index)`: Get specific module
- `setModule(candidate, index, module)`: Update specific module
- `concatenateModules(candidate)`: Combine modules for execution
- `serializeCandidate(candidate)`: Serialize for storage
- `deserializeCandidate(serialized)`: Deserialize from storage

### Reflection (`src/reflection.ts`)

- `buildModuleReflectionPrompt()`: Create module-specific reflection prompts
- `proposeNewModule()`: Update specific module while preserving others

### GEPA State (`src/types.ts`)

Extended `GEPAState` interface:
```typescript
interface GEPAState {
  // ... existing fields ...
  moduleIndex?: number;  // Current module for round-robin
  moduleCount?: number;  // Total number of modules
}
```

## Module-Targeted Reflection

When mutating a specific module, the LLM receives:

1. **Context**: All modules in the system
2. **Target**: Which module to update (marked with `>>>`)
3. **Preservation**: Instructions to keep other modules unchanged
4. **Examples**: Feedback from minibatch execution
5. **Strategy hints**: Optional guidance for the mutation

Example reflection prompt:
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

## Testing

The implementation includes comprehensive tests:

- **Unit tests**: `tests/modules.test.ts` - Core utility functions
- **Integration tests**: `tests/modular.integration.test.ts` - End-to-end functionality
- **Type tests**: `tests/types.test.ts` - Type safety verification

## Benefits

1. **Focused Optimization**: Each module can be optimized independently
2. **Preserved Expertise**: Successful modules remain unchanged during mutation
3. **Systematic Exploration**: Round-robin ensures all modules get attention
4. **Backward Compatibility**: Existing workflows continue to work
5. **Scalable**: Supports systems with any number of modules

## Future Enhancements

- **Module-aware crossover**: Merge complementary modules from different candidates
- **Module-specific strategies**: Different mutation strategies per module type
- **Hierarchical modules**: Support for nested module structures
- **Module validation**: Ensure module compatibility and coherence
