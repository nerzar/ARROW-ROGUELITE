// UI-001: types for the plain-JS viewer module ./scene-sync.js (kept as .js so the
// browser visual-proto shell can import it directly; this .d.ts only serves tsc/vitest).
export interface SceneSyncInput { kind: string; entryKey: string | null; idx: number; stepCount: number; sequenceKeys?: string[] }
export interface SceneSyncResult { key: string; transient: boolean }
export declare function resolveActiveSceneKey(input: SceneSyncInput): SceneSyncResult
