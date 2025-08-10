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

/**
 * Merge two parent candidates to create a child candidate
 * Uses module-level ancestry and scores to determine which modules to take from each parent
 */
export function mergeCandidates(
  parentA: Candidate,
  parentB: Candidate,
  lineageA: number[],
  lineageB: number[],
  scoreA: number,
  scoreB: number,
  baseCandidate?: Candidate
): Candidate {
  // Check for incompatible structures first
  if ((isSingleSystem(parentA) && isModular(parentB)) || (isModular(parentA) && isSingleSystem(parentB))) {
    throw new Error('Cannot merge candidates with incompatible structures');
  }
  
  // Ensure both parents have the same module structure
  const moduleCountA = getModuleCount(parentA);
  const moduleCountB = getModuleCount(parentB);
  
  if (moduleCountA !== moduleCountB) {
    throw new Error('Cannot merge candidates with different module counts');
  }
  
  const moduleCount = moduleCountA;
  
  // For single-system candidates, treat as 1 module
  if (moduleCount === 1) {
    // Simple case: take the better scoring parent's system
    const betterParent = scoreA >= scoreB ? parentA : parentB;
    return cloneCandidate(betterParent);
  }
  
  // For modular candidates, merge module by module
  if (isModular(parentA) && isModular(parentB)) {
    const mergedModules: Module[] = [];
    
    for (let moduleIndex = 0; moduleIndex < moduleCount; moduleIndex++) {
      const changedInA = lineageA.includes(moduleIndex);
      const changedInB = lineageB.includes(moduleIndex);
      
      let selectedModule: Module;
      
      if (changedInA && !changedInB) {
        // Only parent A changed this module - take from A
        selectedModule = parentA.modules[moduleIndex];
      } else if (changedInB && !changedInA) {
        // Only parent B changed this module - take from B
        selectedModule = parentB.modules[moduleIndex];
      } else if (changedInA && changedInB) {
        // Both parents changed this module - take from the better scoring parent
        const betterParent = scoreA >= scoreB ? parentA : parentB;
        selectedModule = betterParent.modules[moduleIndex];
      } else {
        // Neither parent changed this module - take from parent A (default)
        selectedModule = parentA.modules[moduleIndex];
      }
      
      mergedModules.push({ ...selectedModule });
    }
    
    return { modules: mergedModules };
  }
  
  throw new Error('Cannot merge candidates with incompatible structures');
}

/**
 * Check if two candidates are direct ancestors/descendants
 */
export function areDirectRelatives(
  candidateIndexA: number,
  candidateIndexB: number,
  lineage: Array<{ candidateIndex: number; parentIndex?: number }>
): boolean {
  // Check if A is a direct ancestor of B
  let current: number | undefined = candidateIndexB;
  while (current !== undefined) {
    const entry = lineage.find(l => l.candidateIndex === current);
    if (!entry) break;
    if (entry.parentIndex === candidateIndexA) return true;
    current = entry.parentIndex;
  }
  
  // Check if B is a direct ancestor of A
  current = candidateIndexA;
  while (current !== undefined) {
    const entry = lineage.find(l => l.candidateIndex === current);
    if (!entry) break;
    if (entry.parentIndex === candidateIndexB) return true;
    current = entry.parentIndex;
  }
  
  return false;
}

/**
 * Check if a merge triplet (parentA, parentB, ancestor) has been tried before
 */
export function hasBeenTriedBefore(
  parentAIndex: number,
  parentBIndex: number,
  ancestorIndex: number,
  triedTriplets: Array<[number, number, number]>
): boolean {
  // Check both orderings since merge is symmetric
  return triedTriplets.some(([a, b, anc]) => 
    (a === parentAIndex && b === parentBIndex && anc === ancestorIndex) ||
    (a === parentBIndex && b === parentAIndex && anc === ancestorIndex)
  );
}

/**
 * Find a shared ancestor between two candidates
 */
export function findSharedAncestor(
  candidateIndexA: number,
  candidateIndexB: number,
  lineage: Array<{ candidateIndex: number; parentIndex?: number }>
): number | null {
  // Get all ancestors of A (including A itself)
  const ancestorsA = new Set<number>();
  let current: number | undefined = candidateIndexA;
  while (current !== undefined) {
    ancestorsA.add(current);
    const entry = lineage.find(l => l.candidateIndex === current);
    if (!entry) break;
    if (entry.parentIndex !== undefined) {
      current = entry.parentIndex;
    } else {
      break;
    }
  }
  
  // Check if any ancestor of B is also an ancestor of A
  current = candidateIndexB;
  while (current !== undefined) {
    if (ancestorsA.has(current)) {
      return current;
    }
    const entry = lineage.find(l => l.candidateIndex === current);
    if (!entry) break;
    if (entry.parentIndex !== undefined) {
      current = entry.parentIndex;
    } else {
      break;
    }
  }
  
  return null;
}

/**
 * Check if a merged candidate introduces module-level novelty
 */
export function hasModuleNovelty(
  mergedCandidate: Candidate,
  parentA: Candidate,
  parentB: Candidate,
  lineageA: number[],
  lineageB: number[]
): boolean {
  const moduleCount = getModuleCount(mergedCandidate);
  
  // If merged candidate is identical to one of the parents, no novelty
  if (JSON.stringify(mergedCandidate) === JSON.stringify(parentA) || 
      JSON.stringify(mergedCandidate) === JSON.stringify(parentB)) {
    return false;
  }
  
  for (let moduleIndex = 0; moduleIndex < moduleCount; moduleIndex++) {
    const moduleA = getModule(parentA, moduleIndex);
    const moduleB = getModule(parentB, moduleIndex);
    const moduleMerged = getModule(mergedCandidate, moduleIndex);
    
    if (!moduleA || !moduleB || !moduleMerged) continue;
    
    // Check if this module is different from both parents
    const changedInA = lineageA.includes(moduleIndex);
    const changedInB = lineageB.includes(moduleIndex);
    
    if (changedInA && changedInB) {
      // Both parents changed this module - check if merged is different from both
      if (moduleMerged.prompt !== moduleA.prompt && moduleMerged.prompt !== moduleB.prompt) {
        return true;
      }
    } else if (changedInA && !changedInB) {
      // Only A changed - check if merged is different from B
      if (moduleMerged.prompt !== moduleB.prompt) {
        return true;
      }
    } else if (changedInB && !changedInA) {
      // Only B changed - check if merged is different from A
      if (moduleMerged.prompt !== moduleA.prompt) {
        return true;
      }
    }
  }
  
  return false;
}
