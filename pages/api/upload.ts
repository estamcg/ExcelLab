// pages/api/upload.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin, BUCKET_NAME } from "@/lib/supabase";
import formidable, { File } from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return res.status(403).json({ error: "Accès refusé" });
  }

  const form = formidable({ maxFileSize: 50 * 1024 * 1024 }); // 50 Mo max

  try {
    const [, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) return res.status(400).json({ error: "Aucun fichier reçu" });

    const buffer = fs.readFileSync((file as File).filepath);
    const originalName = (file as File).originalFilename ?? "document";
    const mimeType = (file as File).mimetype ?? "application/octet-stream";
    const fileSize = formatFileSize((file as File).size);

    const storagePath = `documents/${Date.now()}-${originalName.replace(/\s+/g, "_")}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      return res.status(500).json({ error: `Erreur upload: ${uploadError.message}` });
    }

    const { data } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    // Nettoyer le fichier temporaire
    fs.unlinkSync((file as File).filepath);

    return res.status(200).json({
      url: data.publicUrl,
      fileName: originalName,
      fileSize,
      mimeType,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Erreur serveur" });
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
