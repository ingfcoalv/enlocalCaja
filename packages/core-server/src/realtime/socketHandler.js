import jwt from 'jsonwebtoken';
const connectedDevices = new Map();
export function setupSocketHandlers(io, jwtSecret) {
    const secret = jwtSecret || 'enlocal-suite-jwt-secret';
    // Auth middleware for Socket.io handshake
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Token de autenticación requerido'));
        }
        try {
            const decoded = jwt.verify(token, secret);
            socket.data.user = decoded;
            next();
        }
        catch {
            next(new Error('Token inválido'));
        }
    });
    io.on('connection', (socket) => {
        const user = socket.data.user;
        const deviceType = socket.handshake.query.deviceType || 'desktop';
        // Track connected device
        connectedDevices.set(socket.id, {
            socketId: socket.id,
            userId: user.id,
            userName: user.name,
            deviceType,
            connectedAt: new Date(),
        });
        // Broadcast updated device list
        io.emit('devices:updated', Array.from(connectedDevices.values()));
        socket.on('disconnect', () => {
            connectedDevices.delete(socket.id);
            io.emit('devices:updated', Array.from(connectedDevices.values()));
        });
    });
}
export function getConnectedDevices() {
    return Array.from(connectedDevices.values());
}
//# sourceMappingURL=socketHandler.js.map