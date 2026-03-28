// pages/api/documents/[id].ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const { id } = req.query as { id: string };

  if (!session || (session.user as any).role !== "ADMIN") {
    return res.status(403).json({ error: "Accès refusé" });
  }

  // ── PUT : modifier un document ──
  if (req.method === "PUT") {
    const { title, description, type, level, icon } = req.body;

    const doc = await prisma.document.update({
      where: { id },
      data: { title, description, type, level, icon },
    });

    return res.status(200).json(doc);
  }

  // ── DELETE : supprimer un document + son fichier ──
  if (req.method === "DELETE") {
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: "Document introuvable" });

    // Supprimer le fichier dans Supabase Storage
    if (doc.fileUrl) await deleteFile(doc.fileUrl);

    // Supprimer en base
    await prisma.document.delete({ where: { id } });

    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", ["PUT", "DELETE"]);
  return res.status(405).json({ error: "Méthode non autorisée" });
}
