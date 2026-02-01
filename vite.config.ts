import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  return {
    server: {
      port: 3000,
      headers: {
        // Security headers for development
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
      },
    },
    optimizeDeps: {
      include: ['decimal.js-light'],
    },
    ssr: {
      noExternal: ['recharts', 'decimal.js-light'],
    },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // Suppress unresolved import warnings from excluded tsconfig files
          if (warning.code === 'UNRESOLVED_IMPORT') return;
          warn(warning);
        },
      },
    },
    plugins: [
      tsConfigPaths({ projects: ['./tsconfig.build.json'] }),
      tailwindcss(),
      tanstackStart(),
      nitro({
        // Production security headers
        routeRules: {
          '/**': {
            headers: {
              // Prevent MIME type sniffing
              'X-Content-Type-Options': 'nosniff',
              // Prevent clickjacking
              'X-Frame-Options': 'DENY',
              // XSS protection (legacy but still useful)
              'X-XSS-Protection': '1; mode=block',
              // Referrer policy
              'Referrer-Policy': 'strict-origin-when-cross-origin',
              // Permissions policy
              'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
              // HSTS (only in production)
              ...(mode === 'production' ? {
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
              } : {}),
            },
          },
        },
      }),
      viteReact(),
    ],
  };
});
