/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      rules: {
        // Exclude problematic modules from client-side bundling
        '*.css': {
          loaders: ['postcss-loader'],
          as: '*.css',
        },
      },
    },
  },
  webpack: (config) => {
    // Add fallbacks for Node.js modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };
    return config;
  },
  // Tambahkan konfigurasi images di sini
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