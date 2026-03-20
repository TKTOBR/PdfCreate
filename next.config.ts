import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['jspdf', 'html2canvas'],
};

export default nextConfig;
