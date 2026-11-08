import type { DataSource } from './types';

/** Picks the data source from VITE_DATA_SOURCE. Each branch is code-split. */
export async function createDataSource(): Promise<DataSource> {
  if (import.meta.env.VITE_DATA_SOURCE === 'firebase') {
    const m = await import('./firebaseSource');
    return m.createFirebaseSource();
  }
  const m = await import('./mockSource');
  return m.createMockSource();
}
