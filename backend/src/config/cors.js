// One place that decides which websites may call the API and open sockets.
// CLIENT_URL in .env can hold one address or several separated by commas.

function getAllowedOrigins() {
  return (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isOriginAllowed(origin) {
  // No Origin header means the caller is not a browser page (test scripts,
  // curl, server-to-server), so CORS does not apply.
  if (!origin) return true;
  if (getAllowedOrigins().includes(origin)) return true;
  // While developing (NODE_ENV is not "production"), any local port is fine,
  // because Vite may pick 5174, 5175, ... when 5173 is busy.
  return process.env.NODE_ENV !== 'production' && LOCAL_DEV_ORIGIN.test(origin);
}

const corsOptions = {
  origin(origin, callback) {
    callback(null, isOriginAllowed(origin));
  },
};

module.exports = { corsOptions, isOriginAllowed, getAllowedOrigins };