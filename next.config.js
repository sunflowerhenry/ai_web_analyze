/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 优化生产环境性能
  output: 'standalone',
  
  // 压缩配置
  compress: true,
  
  // 优化图片
  images: {
    unoptimized: true,
    domains: ['images.unsplash.com'],
  },
  
  // 实验性功能
  experimental: {
    // 优化内存使用
    serverMinification: true
  },
  
  // 优化bundler
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // 生产环境优化
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
          },
        },
      }
    }
    
    return config
  },
  
  env: {
    // 在生产环境中禁用文件系统存储
    DISABLE_FILE_STORAGE: process.env.NODE_ENV === 'production' ? 'true' : 'false',
    // 设置最大存储条目数
    MAX_STORAGE_ITEMS: process.env.MAX_STORAGE_ITEMS || '10000',
    // 数据过期时间（天）
    DATA_EXPIRY_DAYS: process.env.DATA_EXPIRY_DAYS || '7',
  },
  
  // 生产环境安全头
  async headers() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'DENY',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
            {
              key: 'Referrer-Policy',
              value: 'strict-origin-when-cross-origin',
            },
            {
              key: 'Permissions-Policy',
              value: 'camera=(), microphone=(), location=(), payment=()',
            },
          ],
        },
        {
          source: '/api/(.*)',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-store, no-cache, must-revalidate',
            },
          ],
        },
      ]
    }
    return []
  },
}

export default nextConfig
