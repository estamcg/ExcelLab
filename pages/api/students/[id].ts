// pages/api/students/[id].ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return res.status(403).json({ error: "Accès refusé" });
  }

  const { id } = req.query as { id: string };

  if (req.method === "DELETE") {
    await prisma.user.delete({ where: { id } });
    return res.status(200).json({ success: true });
  }

  res.setHeader("Allow", ["DELETE"]);
  return res.status(405).json({ error: "Méthode non autorisée" });
}
