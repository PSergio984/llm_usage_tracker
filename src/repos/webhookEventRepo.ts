import { pool } from '../db/pool.js';

export const webhookEventRepo = {
  async tryInsert(eventId: string, type: string, payload: any): Promise<boolean> {
    const { rowCount } = await pool.query(
      `INSERT INTO webhook_events (event_id, type, payload) VALUES ($1,$2,$3) ON CONFLICT (event_id) DO NOTHING`,
      [eventId, type, payload]
    );
    return (rowCount ?? 0) === 1;
  },
  async exists(eventId: string): Promise<boolean> {
    const { rows } = await pool.query(`SELECT 1 FROM webhook_events WHERE event_id=$1`, [eventId]);
    return rows.length > 0;
  },
};
