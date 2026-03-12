import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '@enlocal/core-server';
import { createPayment, refundPayment } from '../services/payments.service';
import { getCurrentShift } from '../services/cashShifts.service';
const paymentEntrySchema = z.object({
    method: z.enum(['cash', 'card', 'transfer', 'credit']),
    amount: z.union([z.string(), z.number()]).transform(Number),
    reference: z.string().optional(),
    tip: z.union([z.string(), z.number()]).transform(Number).optional(),
});
const createPaymentSchema = z.object({
    invoice_id: z.string().uuid(),
    payments: z.array(paymentEntrySchema).min(1),
});
const refundSchema = z.object({
    amount: z.union([z.string(), z.number()]).transform(Number),
    reason: z.string().min(1),
});
const router = Router();
// POST / — create payment(s) for an invoice
router.post('/', requirePermission('pos.create'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const parsed = createPaymentSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });
        }
        const userId = req.user?.id ?? 'system';
        // Get current open shift for the user (may be null if no shift is open)
        const currentShift = await getCurrentShift(db, userId);
        const shiftId = currentShift?.id ?? null;
        const result = await createPayment(db, {
            invoiceId: parsed.data.invoice_id,
            payments: parsed.data.payments.map((p) => ({
                method: p.method,
                amount: p.amount,
                reference: p.reference,
                tip: p.tip,
            })),
        }, userId, shiftId);
        res.status(201).json({ data: result });
    }
    catch (err) {
        if (err.message?.includes('not found')) {
            return res.status(404).json({ error: err.message });
        }
        if (err.message?.includes('already fully paid')) {
            return res.status(409).json({ error: err.message });
        }
        res.status(500).json({ error: err.message || 'Error creating payment' });
    }
});
// POST /:id/refund — refund a payment
router.post('/:id/refund', requirePermission('pos.delete'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const { id } = req.params;
        const parsed = refundSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });
        }
        const userId = req.user?.id ?? 'system';
        const result = await refundPayment(db, id, parsed.data.amount, parsed.data.reason, userId);
        res.json({ data: result });
    }
    catch (err) {
        if (err.message?.includes('not found')) {
            return res.status(404).json({ error: err.message });
        }
        if (err.message?.includes('cannot exceed')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: err.message || 'Error processing refund' });
    }
});
export default router;
//# sourceMappingURL=payments.routes.js.map