// The admin dashboard (accounts, VAT, invoices) is its own service in apps/admin. The website
// forwards everything under /admin to it, so it lives at yoursite.com/admin.
// ADMIN_URL: the admin service's address (Railway private URL in production).
const ADMIN_URL = (process.env.ADMIN_URL || "http://127.0.0.1:8501").replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The admin app's own routing handles /admin and /admin/ (no redirect loop through the proxy).
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      { source: "/admin", destination: `${ADMIN_URL}/admin` },
      { source: "/admin/:path*", destination: `${ADMIN_URL}/admin/:path*` },
    ];
  },
};

export default nextConfig;
