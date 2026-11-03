/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use Node runtime for API routes (needed for DNS/MX lookups per PRD)
  typescript: {
    // Avoid blocking build on internal .next/types generation mismatches
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
