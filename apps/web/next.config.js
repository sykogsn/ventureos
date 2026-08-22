/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/ids"],
  serverExternalPackages: ["@libsql/client"],
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
