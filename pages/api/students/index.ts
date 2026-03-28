// pages/api/students/index.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return res.status(403).json({ error: "Accès refusé" });
  }

  if (req.method === "GET") {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { downloads: true } } },
    });
    return res.status(200).json(students);
  }

  res.setHeader("Allow", ["GET"]);
  return res.status(405).json({ error: "Méthode non autorisée" });
}
