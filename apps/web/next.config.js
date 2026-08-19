/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/ids"],
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
