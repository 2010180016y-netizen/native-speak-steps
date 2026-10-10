import { aiHandler, json, sql, z } from "./_lib/ai.js";

// Reuses the shared handler for auth, request validation and error responses.
export const POST = aiHandler("delete-account", z.object({}), async (_body, { userId }) => {
  // Every per-user table references neon_auth."user" with ON DELETE CASCADE,
  // and deleting the user also ends their sessions.
  await sql`DELETE FROM neon_auth."user" WHERE id = ${userId}`;
  return json({ deleted: true });
}, { quota: false });
