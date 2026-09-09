/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/ids"],
  // @repo/storage-authority-kernel must remain a Node-cached singleton (not
  // inlined into duplicated server chunks) so issuance WeakSet identity is one.
  serverExternalPackages: ["@libsql/client", "@repo/storage-authority-kernel"],
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
