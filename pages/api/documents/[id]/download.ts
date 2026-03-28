// pages/api/documents/[id]/download.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Non authentifié" });

  const { id } = req.query as { id: string };
  const userId = (session.user as any).id;

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return res.status(404).json({ error: "Document introuvable" });

  // Enregistrer le téléchargement (si l'utilisateur a un ID DB réel)
  if (userId && userId !== "admin-fixed") {
    await prisma.download.create({
      data: { userId, documentId: id },
    }).catch(() => {}); // ignore les erreurs de doublon
  }

  // Générer URL signée Supabase (1 heure)
  const signedUrl = await getSignedUrl(doc.fileUrl);
  if (!signedUrl) {
    // Fallback: URL publique directe
    return res.status(200).json({ url: doc.fileUrl, fileName: doc.fileName });
  }

  return res.status(200).json({ url: signedUrl, fileName: doc.fileName });
}
