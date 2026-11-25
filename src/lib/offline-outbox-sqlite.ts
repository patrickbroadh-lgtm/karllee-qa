import type { SQLiteDatabase } from 'expo-sqlite';
import { newOfflineOutboxItem, claimOfflineOutboxItem, type OfflineOutboxItem } from './offline-outbox-state.ts';
import { restoreOfflineOutboxItem } from './offline-outbox-restore.ts';
import { assertOfflineDraftOwner } from './offline-draft-envelope.ts';

/** Explicitly initialized by the future queue owner. Stores references, not evidence bytes.
 * Local scope checks are not encryption or server authorization.
 * Do not enable replay until server idempotency and device acceptance are verified.
 */
export class SQLiteOfflineOutbox {
  constructor(private readonly db: SQLiteDatabase) {}
  async initialize(): Promise<void> {
    await this.db.execAsync(`CREATE TABLE IF NOT EXISTS qa_offline_outbox_v1 (
      user_id TEXT NOT NULL, project_id TEXT NOT NULL, draft_id TEXT NOT NULL,
      record TEXT NOT NULL, PRIMARY KEY (user_id, project_id, draft_id)
    );`);
  }
  async enqueue(value: unknown, userId: string, projectId: string): Promise<void> {
    const item = newOfflineOutboxItem(value);
    assertOfflineDraftOwner(item.draft, userId, projectId);
    await this.db.runAsync('INSERT INTO qa_offline_outbox_v1 (user_id, project_id, draft_id, record) VALUES (?, ?, ?, ?)',
      userId, projectId, item.draft.id, JSON.stringify(item));
  }
  async claim(userId: string, projectId: string, draftId: string, nowMs: number): Promise<OfflineOutboxItem> {
    const row = await this.db.getFirstAsync<{ record: string }>(
      'SELECT record FROM qa_offline_outbox_v1 WHERE user_id = ? AND project_id = ? AND draft_id = ?', userId, projectId, draftId);
    if (!row) throw new Error('Offline draft not found');
    const item = restoreOfflineOutboxItem(JSON.parse(row.record));
    if (item.draft.id !== draftId) throw new Error('Offline draft identifier mismatch');
    const claimed = claimOfflineOutboxItem(item, userId, projectId, nowMs);
    // Compare-and-swap prevents two workers claiming the same saved version.
    const result = await this.db.runAsync(
      'UPDATE qa_offline_outbox_v1 SET record = ? WHERE user_id = ? AND project_id = ? AND draft_id = ? AND record = ?',
      JSON.stringify(claimed), userId, projectId, draftId, row.record);
    if (result.changes !== 1) throw new Error('Offline draft changed during claim');
    return claimed;
  }
}
