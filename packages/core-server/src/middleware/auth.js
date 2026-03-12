import jwt from 'jsonwebtoken';
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token de autenticación requerido' });
        return;
    }
    const token = authHeader.slice(7);
    const secret = req.app.get('jwtSecret');
    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token inválido o expirado' });
    }
}
//# sourceMappingURL=auth.js.map