/**
 * Global Express error handler.
 *
 * Respects:
 *  - `err.status` / `err.statusCode` set on thrown errors (e.g. 404 from service layer)
 *  - `res.statusCode` if it was already changed before calling next(err)
 *  - Falls back to 500 for anything unrecognised
 *
 * Logs every server-side error to the console with context (method, url, status).
 * In development mode, the response also includes a `stack` field for easier debugging.
 */
const errorHandler = (err, req, res, next) => {
  // Determine the correct HTTP status code
  const statusCode =
    err.status ||
    err.statusCode ||
    (res.statusCode !== 200 ? res.statusCode : 500);

  // Always log unexpected server errors (>= 500) with the full stack
  if (statusCode >= 500) {
    console.error(
      `❌ [Error] ${req.method} ${req.originalUrl} → ${statusCode}: ${err.message}`
    );
    if (err.stack) {
      console.error(err.stack);
    }
  } else {
    // Log 4xx as warnings — useful for diagnosing missing resources without noise
    console.warn(
      `⚠️  [Error] ${req.method} ${req.originalUrl} → ${statusCode}: ${err.message}`
    );
  }

  const body = {
    success: false,
    message: err.message || 'Internal Server Error'
  };

  // Expose stack traces only in development to avoid leaking internals in production
  if (process.env.NODE_ENV === 'development' && err.stack) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};

module.exports = errorHandler;

