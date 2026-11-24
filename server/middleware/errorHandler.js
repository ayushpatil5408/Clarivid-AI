export function errorHandler(err, _req, res, _next) {
  console.error('Server error:', err.message || err)
  const status = typeof err.status === 'number' ? err.status : 500
  res.status(status).json({
    error: err.message || 'Internal Server Error'
  })
}
