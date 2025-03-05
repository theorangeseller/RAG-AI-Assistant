/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Add a fallback for the 'fs' module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    // Handle the transformers package
    config.module = {
      ...config.module,
      exprContextCritical: false,
    };

    // Exclude specific modules from being bundled
    config.externals = [
      ...config.externals || [],
      { 'utf-8-validate': 'commonjs utf-8-validate' },
      { 'pdf-parse': 'commonjs pdf-parse' }
    ];

    // Exclude test files and specific directories from being processed
    config.module.rules.push({
      test: /\.(js|ts|pdf)$/,
      include: /[\\/]test[\\/]|[\\/]tests[\\/]/,
      loader: 'ignore-loader',
    });

    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['chromadb', 'pdf-parse'],
  },
};

module.exports = nextConfig; 