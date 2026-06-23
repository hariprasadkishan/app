import env from "./env.config.js";

const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc:  ["'self'"],
      fontSrc:     ["'self'"],
      objectSrc:   ["'none'"],
      // Google Meet embeds (for online classes)
      frameSrc:    ["'self'", "https://meet.google.com"],
      upgradeInsecureRequests: env.NODE_ENV === "production" ? [] : null,
    },
  },


  noSniff:          true,
  xssFilter:        true,
  hidePoweredBy:    true,
  frameguard:       { action: "sameorigin" }, // relaxed from deny to allow GMeet iframes
  referrerPolicy:   { policy: "strict-origin-when-cross-origin" },

  hsts: env.NODE_ENV === "production"
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,

  crossOriginEmbedderPolicy:  false,          // allow Cloudinary media
  crossOriginOpenerPolicy:    { policy: "same-origin" },
  crossOriginResourcePolicy:  { policy: "cross-origin" },
};

export default helmetOptions;
