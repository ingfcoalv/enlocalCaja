import { authMiddleware } from '@enlocal/core-server';
import salesRoutes from './routes/sales.routes';
import cashShiftsRoutes from './routes/cashShifts.routes';
import paymentsRoutes from './routes/payments.routes';
import receiptsRoutes from './routes/receipts.routes';
import creditRoutes from './routes/credit.routes';
import { ensureSchemaMigrations } from './services/sales.service';
export function mountPosRoutes(app, db) {
    app.set('db', db);
    // Run schema migrations for new columns
    ensureSchemaMigrations(db).catch((err) => console.error('[mod-pos] Schema migration error:', err.message));
    app.use('/api/sales', authMiddleware, salesRoutes);
    app.use('/api/pos/shifts', authMiddleware, cashShiftsRoutes);
    app.use('/api/payments', authMiddleware, paymentsRoutes);
    app.use('/api/receipts', authMiddleware, receiptsRoutes);
    app.use('/api/credit', authMiddleware, creditRoutes);
}
//# sourceMappingURL=mount.js.map