// pages/api/admin/stats.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return res.status(403).json({ error: "Accès refusé" });
  }

  const [totalDocs, totalStudents, totalDownloads, docsByType, recentDownloads] =
    await Promise.all([
      prisma.document.count(),
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.download.count(),
      prisma.document.groupBy({ by: ["type"], _count: { id: true } }),
      prisma.download.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, email: true, image: true } },
          document: { select: { title: true, icon: true } },
        },
      }),
    ]);

  return res.status(200).json({
    totalDocs,
    totalStudents,
    totalDownloads,
    docsByType,
    recentDownloads,
  });
}
