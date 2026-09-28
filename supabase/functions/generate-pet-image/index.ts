import { aiHandler, callModel, HttpError, json, MODELS, z } from "../_shared/ai.ts";

const schema = z.object({ petId: z.string().uuid() });

const IMAGE_MILESTONES = [1, 5, 10, 15, 20, 25, 30];

const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: "a tiny adorable baby puppy/kitten, very small and round, with big innocent eyes",
  5: "a playful young puppy/kitten, slightly bigger, curious and energetic",
  10: "a growing juvenile, more defined features, athletic and alert",
  15: "a healthy teenager, strong build, confident posture",
  20: "a majestic fully grown adult, beautiful coat, proud stance",
  25: "a wise and distinguished senior, calm and elegant demeanor",
  30: "a legendary champion, glowing aura, perfect form, mythical presence",
};

Deno.serve(aiHandler("generate-pet-image", schema, async ({ petId }, ctx) => {
  // Name, species and level come from the caller's own pet row, not from the request.
  const { data: pet } = await ctx.supabase
    .from("user_pets")
    .select("id, name, level, pet_types(species)")
    .eq("id", petId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!pet) throw new HttpError(404, "펫을 찾을 수 없어요.", "not_found");

  const milestoneLevel = IMAGE_MILESTONES.filter((m) => m <= pet.level).pop() || 1;
  const stageDesc = STAGE_DESCRIPTIONS[milestoneLevel] || "an adorable";
  const petType = Array.isArray(pet.pet_types) ? pet.pet_types[0] : pet.pet_types;
  const speciesName = petType?.species === "cat" ? "cat" : "dog";
  const breedHint = pet.name ? ` named ${pet.name}` : "";

  const prompt = `A realistic high-quality photograph of ${stageDesc.replace("puppy/kitten", speciesName === "cat" ? "kitten" : "puppy")}${breedHint}. The ${speciesName} is looking at the camera with a happy expression, sitting in a cozy home environment. Professional pet photography style, soft natural lighting, shallow depth of field, warm tones. Clean simple background. The ${speciesName} should look realistic and lifelike, not cartoon or illustration. Growth stage level ${milestoneLevel} of 30.`;

  const { data } = await callModel(ctx, {
    model: MODELS.image,
    messages: [{ role: "user", content: prompt }],
    modalities: ["image", "text"],
  });

  const imageDataUrl: string | undefined = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageDataUrl) throw new HttpError(502, "이미지를 생성하지 못했어요.", "gateway_error");

  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
  const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const filePath = `${ctx.userId}/${pet.id}/level-${milestoneLevel}.png`;

  const { error: uploadError } = await ctx.admin.storage
    .from("pet-images")
    .upload(filePath, imageBytes, { contentType: "image/png", upsert: true });
  if (uploadError) throw new Error(`upload failed: ${uploadError.message}`);

  const { data: publicUrl } = ctx.admin.storage.from("pet-images").getPublicUrl(filePath);
  await ctx.admin
    .from("user_pets")
    .update({ image_url: publicUrl.publicUrl })
    .eq("id", pet.id)
    .eq("user_id", ctx.userId);

  return json({ image_url: publicUrl.publicUrl, milestone_level: milestoneLevel });
}));
