/**
 * helmet.config.js
 *
 * Helmet middleware configuration for HTTP security headers.
 *
 * Each directive is explicitly reasoned — we avoid "turn everything on"
 * defaults because overly strict CSP breaks legitimate functionality.
 *
 * SCALABILITY: Helmet runs per-request but is O(1) — safe at any scale.
 */

const helmetOptions = {
  // Content-Security-Policy: prevent XSS / data injection
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Remove unsafe-inline once frontend is hardened
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },

  // Prevent MIME sniffing attacks
  noSniff: true,

  // Force HTTPS for 1 year, include subdomains
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },

  // Deny framing to prevent clickjacking
  frameguard: { action: "deny" },

  // Disable X-Powered-By (don't advertise Express)
  hidePoweredBy: true,

  // XSS filter for legacy browsers
  xssFilter: true,

  // Referrer policy: only send origin on same-origin requests
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },

  // Cross-Origin policies
  crossOriginEmbedderPolicy: false,    // Relax for Cloudinary media
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" },  // Allow CDN resources
};

export default helmetOptions;