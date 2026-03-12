export function errorHandler(err, _req, res, _next) {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Error interno del servidor';
    const code = err.code || 'INTERNAL_ERROR';
    if (statusCode === 500) {
        console.error('[enlocal-server] Error:', err);
    }
    res.status(statusCode).json({
        error: code,
        message,
        statusCode,
    });
}
//# sourceMappingURL=errorHandler.js.map