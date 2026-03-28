// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// Client public (pour lecture côté client)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Client admin avec service role (côté serveur uniquement)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

export const BUCKET_NAME = "course-documents";

// Upload d'un fichier dans Supabase Storage
export async function uploadFile(
  file: File | Buffer,
  fileName: string,
  mimeType: string
): Promise<{ url: string; error: string | null }> {
  const path = `documents/${Date.now()}-${fileName}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) return { url: "", error: error.message };

  const { data } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// Supprimer un fichier
export async function deleteFile(fileUrl: string): Promise<void> {
  const path = fileUrl.split(`${BUCKET_NAME}/`)[1];
  if (!path) return;
  await supabaseAdmin.storage.from(BUCKET_NAME).remove([path]);
}

// Générer une URL signée (valide 1 heure) pour téléchargement sécurisé
export async function getSignedUrl(fileUrl: string): Promise<string | null> {
  const path = fileUrl.split(`${BUCKET_NAME}/`)[1];
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
