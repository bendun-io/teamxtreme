// Express 4 doesn't forward rejected promises from async handlers to error
// middleware on its own — wrap each one so a thrown/rejected error becomes a
// normal next(err) instead of an unhandled rejection.
export function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}
