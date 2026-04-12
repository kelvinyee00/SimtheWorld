import { createClient } from "@/src/utils/supabase/client";
import { parseModelDocument, type PersistedModelV3 } from "./modelPersistence";

export interface SupabaseModelMetadata {
  id: string;
  name: string;
  description?: string;
  updated_at: string;
}

/**
 * Save model to Supabase with version tracking.
 */
export async function saveModelToSupabase(
  model: PersistedModelV3,
  modelId?: string
): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required to save models to the cloud.");
  }

  const modelName = model.metadata.modelName || "Untitled Model";
  const description = model.metadata.description || "";

  let targetModelId = modelId;

  if (!targetModelId) {
    // Create new model entry
    const { data, error } = await supabase
      .from("models")
      .insert({
        name: modelName,
        description: description,
        user_id: user.id,
      })
      .select("id")
      .single();

    if (error) throw error;
    targetModelId = data.id;
  } else {
    // Update existing model entry metadata
    const { error } = await supabase
      .from("models")
      .update({
        name: modelName,
        description: description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetModelId);

    if (error) throw error;
  }

  // Add new version
  const { error: versionError } = await supabase
    .from("model_versions")
    .insert({
      model_id: targetModelId,
      schema_version: model.schemaVersion,
      content: model,
    });

  if (versionError) throw versionError;

  return targetModelId!;
}

/**
 * Load latest version of a model from Supabase.
 */
export async function loadModelFromSupabase(modelId: string): Promise<PersistedModelV3> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("model_versions")
    .select("content")
    .eq("model_id", modelId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Model not found.");

  // We trust Supabase storage but still use parseModelDocument for consistency/migration
  return parseModelDocument(JSON.stringify(data.content));
}

/**
 * List all models for the current user.
 */
export async function listUserModels(): Promise<SupabaseModelMetadata[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("models")
    .select("id, name, description, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []) as SupabaseModelMetadata[];
}
