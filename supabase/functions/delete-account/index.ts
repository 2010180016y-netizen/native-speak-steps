import { aiHandler, json, z } from "../_shared/ai.ts";

// Reuses the shared handler for auth, CORS, request validation and a daily call limit.
Deno.serve(aiHandler("delete-account", z.object({}), async (_body, { userId, admin }) => {
  // Pet images live at <userId>/<petId>/<file> and are not covered by the FK cascade.
  const bucket = admin.storage.from("pet-images");
  const { data: folders } = await bucket.list(userId);
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(`${userId}/${folder.name}`);
    if (files?.length) await bucket.remove(files.map((f) => `${userId}/${folder.name}/${f.name}`));
  }

  // Every per-user table references auth.users with ON DELETE CASCADE.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
  return json({ deleted: true });
}));
