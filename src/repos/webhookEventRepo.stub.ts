// Stub — webhookEventRepo for deduplication
// import { pool } from '../db/pool.js';

// export const webhookEventRepo = {
//   // Returns true if inserted (first time), false if already existed (replay)
//   async tryInsert(eventId: string, type: string, payload: any): Promise<boolean> {
//     const { rowCount } = await pool.query(
//       `INSERT INTO webhook_events (event_id, type, payload) VALUES ($1,$2,$3) ON CONFLICT (event_id) DO NOTHING`,
//       [eventId, type, JSON.stringify(payload)]
//     );
//     return rowCount === 1;
//   },
// };

export const webhookEventRepo = { stub: 'See comment block — PK event_id with ON CONFLICT DO NOTHING for Probe 4 replay ignore' } as any;
