import type { Candidate, Module } from './types.js';

/**
 * Utility functions for handling modular candidates
 */

/**
 * Check if a candidate is modular (has modules array)
 */
export function isModular(candidate: Candidate): candidate is Candidate & { modules: Module[] } {
  return candidate.modules !== undefined && candidate.modules.length > 0;
}

/**
 * Check if a candidate is single-system (has system string)
 */
export function isSingleSystem(candidate: Candidate): candidate is Candidate & { system: string } {
  return candidate.system !== undefined;
}

/**
 * Get the number of modules in a candidate
 */
export function getModuleCount(candidate: Candidate): number {
  if (isModular(candidate)) {
    return candidate.modules.length;
  }
  return 1; // Single system counts as 1 module
}

/**
 * Get a specific module by index
 */
export function getModule(candidate: Candidate, index: number): Module | null {
  if (isModular(candidate)) {
    return candidate.modules[index] || null;
  }
  if (isSingleSystem(candidate) && index === 0) {
    return { id: 'system', prompt: candidate.system };
  }
  return null;
}

/**
 * Set a specific module by index
 */
export function setModule(candidate: Candidate, index: number, module: Module): Candidate {
  if (isModular(candidate)) {
    const newModules = [...candidate.modules];
    newModules[index] = module;
    return { ...candidate, modules: newModules };
  }
  if (isSingleSystem(candidate) && index === 0) {
    return { ...candidate, system: module.prompt };
  }
  throw new Error(`Cannot set module at index ${index} for candidate type`);
}

/**
 * Concatenate modules into a single system prompt for backward compatibility
 */
export function concatenateModules(candidate: Candidate): string {
  if (isSingleSystem(candidate)) {
    return candidate.system;
  }
  if (isModular(candidate)) {
    return candidate.modules.map(m => m.prompt).join('\n\n');
  }
  throw new Error('Candidate must have either system or modules');
}

/**
 * Serialize a candidate to a string representation for storage
 */
export function serializeCandidate(candidate: Candidate): string {
  if (isSingleSystem(candidate)) {
    return candidate.system;
  }
  if (isModular(candidate)) {
    return JSON.stringify({ modules: candidate.modules });
  }
  throw new Error('Candidate must have either system or modules');
}

/**
 * Deserialize a candidate from a string representation
 */
export function deserializeCandidate(serialized: string): Candidate {
  try {
    const parsed = JSON.parse(serialized);
    if (parsed.modules && Array.isArray(parsed.modules)) {
      return { modules: parsed.modules };
    }
  } catch {
    // Not JSON, treat as single system
  }
  return { system: serialized };
}

/**
 * Create a deep copy of a candidate
 */
export function cloneCandidate(candidate: Candidate): Candidate {
  if (isSingleSystem(candidate)) {
    return { system: candidate.system };
  }
  if (isModular(candidate)) {
    return { modules: candidate.modules.map(m => ({ ...m })) };
  }
  throw new Error('Candidate must have either system or modules');
}

/**
 * Validate that a candidate has the expected structure
 */
export function validateCandidate(candidate: Candidate): void {
  if (!isSingleSystem(candidate) && !isModular(candidate)) {
    throw new Error('Candidate must have either system or modules');
  }
  if (isModular(candidate)) {
    if (candidate.modules.length === 0) {
      throw new Error('Modular candidate must have at least one module');
    }
    for (const module of candidate.modules) {
      if (!module.id || !module.prompt) {
        throw new Error('Each module must have id and prompt');
      }
    }
  }
}
