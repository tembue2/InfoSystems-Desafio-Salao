import type { NextConfig } from 'next';
const config: NextConfig = { images: { unoptimized: true }, trailingSlash: true, distDir: process.env.NEXT_PUBLIC_BELA_VIDA_ENVIRONMENT === 'staging' ? '.next-staging' : '.next' };
export default config;
