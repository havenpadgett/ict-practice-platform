import type { NextConfig } from "next";

// Security headers on every response (security audit S7). The app is
// never meant to be framed, so framing is refused outright (clickjacking on
// the chart-drawing UI).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // DEMO MODE (branch demo-mode only; docs/OPERATIONS.md → Demo mode): lets
  // a reviewer reach `next dev` through an ngrok tunnel. Without it Next.js
  // refuses the page's dev scripts from any host but localhost (403), so
  // client-rendered pages never load. Dev server only; ignored in builds.
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "*.ngrok.io"],
  // DEMO MODE: the gate (src/lib/demo/gate.ts) needs to know, in the browser
  // too, whether this is a Vercel preview of the demo-mode branch.
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
    NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF ?? "",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
