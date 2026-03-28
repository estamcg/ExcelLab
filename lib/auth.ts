// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    // ── Google OAuth pour les étudiants ──
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // ── Connexion Admin par identifiant/mot de passe ──
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin",
      credentials: {
        adminId: { label: "Identifiant", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (
          credentials?.adminId === process.env.ADMIN_ID &&
          credentials?.password === process.env.ADMIN_PASSWORD
        ) {
          return {
            id: "admin-fixed",
            name: "Prof. Ninon Hermellon",
            email: "admin@excelmaster.com",
            role: "ADMIN",
          };
        }
        return null;
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    async jwt({ token, user, account }) {
      // À la première connexion, enrichir le token
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? "STUDENT";
      }
      // Si connexion Admin par credentials
      if (account?.provider === "admin-credentials") {
        token.role = "ADMIN";
      }
      // Pour les étudiants Google, récupérer le rôle depuis la DB
      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },

    async signIn({ user, account }) {
      // Mettre à jour lastLogin pour les étudiants Google
      if (account?.provider === "google" && user.email) {
        await prisma.user.update({
          where: { email: user.email },
          data: { lastLogin: new Date() },
        }).catch(() => {}); // ignore si l'user n'existe pas encore
      }
      return true;
    },
  },

  pages: {
    signIn: "/",
    error: "/",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
