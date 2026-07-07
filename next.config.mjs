/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // ESLint nu este configurat in acest proiect; nu bloca build-ul.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        // Never cache the service worker file so updates roll out immediately.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
