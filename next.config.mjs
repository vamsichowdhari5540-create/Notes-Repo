/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["unpdf", "@napi-rs/canvas"],
  },
};

export default nextConfig;
