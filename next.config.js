// next.config.js - PERBAIKI
/** @type {import('next').NextConfig} */
const nextConfig = {
  // HAPUS BAGIAN INI:
  // experimental: {
  //   turbo: {
  //     rules: {
  //       '*.css': {
  //         loaders: ['postcss-loader'],
  //         as: '*.css',
  //       },
  //     },
  //   },
  // },
  
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };
    return config;
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'bdpqkptmdyiouhyoqxod.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig