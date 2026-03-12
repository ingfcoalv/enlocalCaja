import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '@enlocal/core-server';
import { getCurrentShift, openShift, closeShift, getShiftHistory, } from '../services/cashShifts.service';
const openShiftSchema = z.object({
    openingAmount: z.union([z.string(), z.number()]).transform(Number),
});
const closeShiftSchema = z.object({
    closingAmount: z.union([z.string(), z.number()]).transform(Number),
    notes: z.string().optional().default(''),
});
const router = Router();
// GET /current — get current open shift for authenticated user
router.get('/current', async (req, res) => {
    try {
        const db = req.app.get('db');
        const userId = req.user?.id ?? 'system';
        const shift = await getCurrentShift(db, userId);
        if (!shift) {
            return res.json({ data: null, message: 'No open shift found' });
        }
        res.json({ data: shift });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Error getting current shift' });
    }
});
// POST /open — open a new cash shift
router.post('/open', requirePermission('pos.create'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const parsed = openShiftSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });
        }
        const userId = req.user?.id ?? 'system';
        const shift = await openShift(db, userId, parsed.data.openingAmount);
        res.status(201).json({ data: shift });
    }
    catch (err) {
        if (err.message?.includes('already has an open shift')) {
            return res.status(409).json({ error: err.message });
        }
        res.status(500).json({ error: err.message || 'Error opening shift' });
    }
});
// POST /close — close the current cash shift
router.post('/close', requirePermission('pos.create'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const parsed = closeShiftSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });
        }
        const userId = req.user?.id ?? 'system';
        // Find the current open shift for the user
        const currentShift = await getCurrentShift(db, userId);
        if (!currentShift) {
            return res.status(404).json({ error: 'No open shift found for this user' });
        }
        const shift = await closeShift(db, currentShift.id, parsed.data.closingAmount, parsed.data.notes || null);
        res.json({ data: shift });
    }
    catch (err) {
        if (err.message?.includes('not found or already closed')) {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: err.message || 'Error closing shift' });
    }
});
// GET /history — paginated shift history
router.get('/history', requirePermission('pos.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const filters = {
            page: req.query.page ? parseInt(req.query.page, 10) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
        };
        const result = await getShiftHistory(db, filters);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Error loading shift history' });
    }
});
export default router;
//# sourceMappingURL=cashShifts.routes.js.map