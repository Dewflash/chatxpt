import type { NextConfig } from "next";

export function createContentSecurityPolicy(environment = process.env.NODE_ENV) {
  const developmentEval = environment === "development" ? " 'unsafe-eval'" : "";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'self' https://supervisor.ext-twitch.tv https://extension-files.twitch.tv https://*.twitch.tv https://*.twitch.tech https://localhost.twitch.tv:* https://localhost.twitch.tech:* http://localhost.rig.twitch.tv:* https://*.twitch-ext.rootonline.de",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${developmentEval} https://extension-files.twitch.tv`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.twitch.tv wss://pubsub-edge.twitch.tv wss://irc-ws.chat.twitch.tv",
    "media-src 'self' blob:",
  ].join("; ");
}

const contentSecurityPolicy = createContentSecurityPolicy();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      {
        source: "/api/health/deployment",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
