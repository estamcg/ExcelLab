/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google avatars
      { protocol: "https", hostname: "*.supabase.co" },             // Supabase Storage
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
};

module.exports = nextConfig;
