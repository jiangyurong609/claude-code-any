export const DEFAULT_UPLOAD_CONCURRENCY = 5;
export const FILE_COUNT_LIMIT = 100;
export const OUTPUTS_SUBDIR = 'outputs';
export interface FailedPersistence { path: string; error: string; }
export interface FilesPersistedEventData { files: PersistedFile[]; failed: FailedPersistence[]; }
export interface PersistedFile { path: string; size: number; }
export type TurnStartTime = number;
export interface FilePersistenceConfig {}
export type FilePersistenceState = Record<string, unknown>;
