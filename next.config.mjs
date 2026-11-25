/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_EXPORT === '1';
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  images: { unoptimized: true },
  ...(isStatic ? { output: 'export' } : {}),
};
export default nextConfig;
