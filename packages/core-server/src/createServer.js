import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import { errorHandler } from './middleware/errorHandler';
export function createBaseServer(config) {
    const app = express();
    const httpServer = http.createServer(app);
    const io = new SocketServer(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
    });
    // Middleware stack
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    // Inject db, io, and enabledModules into app settings
    app.set('db', config.db);
    app.set('io', io);
    app.set('enabledModules', config.enabledModules || []);
    app.set('jwtSecret', config.jwtSecret || 'enlocal-suite-jwt-secret');
    // Health check endpoint
    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    // Error handler (must be registered last, after routes)
    app.use(errorHandler);
    return { app, io, httpServer };
}
//# sourceMappingURL=createServer.js.map