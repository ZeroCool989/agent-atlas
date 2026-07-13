// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), mdx()],

  /**
   * Content Security Policy (plan §15, DECISIONS.md P0.7): Astro generates a per-page
   * CSP <meta> element with hashes for its own inline island-loader scripts and
   * inlined styles — strict AND host-portable (the policy travels with the HTML, so it
   * holds on any static host, not just Cloudflare). Browsers enforce meta CSP, which
   * makes the Playwright suite a live CSP regression test: if a change ships an
   * unhashed inline script, islands break and e2e fails. Header-only directives
   * (frame-ancestors — ignored in meta CSP) live in public/_headers.
   */
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { resources: ["'self'"] },
      styleDirective: { resources: ["'self'"] },
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
