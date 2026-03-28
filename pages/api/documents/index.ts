// pages/api/documents/index.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  // ── GET : liste tous les documents (authentifié) ──
  if (req.method === "GET") {
    if (!session) return res.status(401).json({ error: "Non authentifié" });

    const docs = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { downloads: true } } },
    });

    return res.status(200).json(docs);
  }

  // ── POST : créer un document (admin seulement) ──
  if (req.method === "POST") {
    if (!session || (session.user as any).role !== "ADMIN") {
      return res.status(403).json({ error: "Accès refusé" });
    }

    const { title, description, type, level, icon, fileName, fileUrl, fileSize, mimeType } = req.body;

    if (!title || !fileUrl) {
      return res.status(400).json({ error: "Titre et URL du fichier requis" });
    }

    const doc = await prisma.document.create({
      data: { title, description, type, level, icon, fileName, fileUrl, fileSize, mimeType },
    });

    return res.status(201).json(doc);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Méthode non autorisée" });
}
