import { Router } from 'express';
import { requirePermission } from '@enlocal/core-server';
import { invoices, invoiceItems, customers } from '@enlocal/core-db';
import { eq, sql } from 'drizzle-orm';
import { listSales, getSalesDashboard, getSalesSummary, getSaleDetail } from '../services/sales.service';
const router = Router();
// POST / — create a quick sale (invoice + items + payments[])
router.post('/', requirePermission('pos.write'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const pool = req.app.get('pool');
        const { items, customerId, payments, paymentMethod, subtotal, tax, total, cashTendered, shiftId, observations } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Se requiere al menos un producto' });
        }
        // Validate item quantities
        for (const item of items) {
            if (!item.quantity || item.quantity <= 0) {
                return res.status(400).json({ error: 'La cantidad de cada producto debe ser mayor a 0' });
            }
        }
        // Reject explicitly empty payments array
        if (payments && Array.isArray(payments) && payments.length === 0) {
            return res.status(400).json({ error: 'Se requiere al menos un metodo de pago' });
        }
        // Normalize payments: support both legacy single paymentMethod and new payments[] array
        let paymentEntries;
        let isLegacyPayment = false;
        if (payments && Array.isArray(payments) && payments.length > 0) {
            paymentEntries = payments;
        }
        else {
            // Legacy single-method payment — amount will be corrected after server-side recalculation
            paymentEntries = [{ method: paymentMethod || 'cash', amount: total || 0 }];
            isLegacyPayment = true;
        }
        // Check if any payment uses credit
        const hasCredit = paymentEntries.some((p) => p.method === 'credit');
        const creditAmount = paymentEntries
            .filter((p) => p.method === 'credit')
            .reduce((sum, p) => sum + (p.amount || 0), 0);
        const nonCreditAmount = paymentEntries
            .filter((p) => p.method !== 'credit')
            .reduce((sum, p) => sum + (p.amount || 0), 0);
        const allCredit = hasCredit && nonCreditAmount === 0;
        // Validate credit: require customerId and check credit limit
        let customer;
        if (hasCredit) {
            if (!customerId) {
                return res.status(400).json({ error: 'Se requiere un cliente para ventas a credito' });
            }
            // Fetch customer credit limit and current balance
            const customerResult = await db
                .select({ id: customers.id, creditLimit: customers.creditLimit, creditBalance: customers.creditBalance, creditDays: customers.creditDays, name: customers.name })
                .from(customers)
                .where(eq(customers.id, customerId))
                .limit(1);
            if (!customerResult.length) {
                return res.status(400).json({ error: 'Cliente no encontrado' });
            }
            customer = customerResult[0];
            const creditLimit = parseFloat(customer.creditLimit ?? '0');
            const currentOutstanding = parseFloat(customer.creditBalance ?? '0');
            if (currentOutstanding + creditAmount > creditLimit) {
                return res.status(400).json({
                    error: `Limite de credito excedido. Disponible: $${(creditLimit - currentOutstanding).toFixed(2)}`,
                });
            }
        }
        // Determine invoice status and payment method code
        let invoiceStatus;
        let invoicePaymentMethod;
        if (allCredit) {
            invoiceStatus = 'credit';
            invoicePaymentMethod = 'PPD';
        }
        else if (hasCredit) {
            invoiceStatus = 'partial';
            invoicePaymentMethod = 'PPD';
        }
        else {
            invoiceStatus = 'paid';
            invoicePaymentMethod = 'PUE';
        }
        // Determine paymentForm for non-credit (first non-credit payment method)
        const firstNonCredit = paymentEntries.find((p) => p.method !== 'credit');
        const paymentFormMap = {
            cash: '01',
            card: '04',
            transfer: '03',
        };
        const paymentForm = firstNonCredit ? (paymentFormMap[firstNonCredit.method] || '99') : '99';
        // Recalculate totals server-side from item prices (net/tax-included)
        let calcSubtotal = 0;
        let calcTax = 0;
        let calcTotal = 0;
        for (const item of items) {
            const lineNet = (item.price ?? 0) * (item.quantity ?? 0);
            const taxRate = item.taxRate ?? 0.16;
            const base = taxRate > 0 ? lineNet / (1 + taxRate) : lineNet;
            calcSubtotal += base;
            calcTax += (lineNet - base);
            calcTotal += lineNet;
        }
        // Correct legacy payment amount to match recalculated total
        if (isLegacyPayment && paymentEntries.length === 1) {
            paymentEntries[0].amount = calcTotal;
        }
        // 1. Create invoice
        const [invoice] = await db
            .insert(invoices)
            .values({
            customerId: customerId || null,
            type: 'I',
            status: invoiceStatus,
            paymentMethod: invoicePaymentMethod,
            paymentForm: paymentForm,
            subtotal: calcSubtotal.toFixed(2),
            tax: calcTax.toFixed(2),
            total: calcTotal.toFixed(2),
            source: 'pos',
            observations: observations || null,
        })
            .returning();
        // 2. Insert invoice items (store base price without tax)
        for (const item of items) {
            const taxRate = item.taxRate ?? 0.16;
            const basePrice = taxRate > 0 ? item.price / (1 + taxRate) : item.price;
            const baseAmount = basePrice * item.quantity;
            await db.insert(invoiceItems).values({
                invoiceId: invoice.id,
                description: item.name,
                quantity: String(item.quantity),
                unitPrice: basePrice.toFixed(2),
                amount: baseAmount.toFixed(2),
                productId: item.productId || null,
                taxRate: String(taxRate),
            });
        }
        // 3. Insert payment records
        for (const payment of paymentEntries) {
            await pool.query(`INSERT INTO payments (invoice_id, method, amount, reference, shift_id, user_id, customer_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                invoice.id,
                payment.method,
                payment.amount || 0,
                payment.reference || null,
                shiftId || null,
                req.user?.id || null,
                payment.method === 'credit' ? customerId : null,
            ]);
        }
        // 4. Create receivable and recalculate credit balance for credit sales
        if (hasCredit && customerId) {
            const creditDays = customer?.creditDays || 30;
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + creditDays);
            await pool.query(`INSERT INTO receivables (customer_id, ticket_id, original_amount, balance, issued_date, due_date, status)
           VALUES ($1, $2, $3, $4, now(), $5, 'current')`, [customerId, invoice.id, creditAmount, creditAmount, dueDate]);
            // Recalculate credit_balance from receivables
            const balResult = await pool.query(`SELECT coalesce(sum(balance), 0) as total FROM receivables
           WHERE customer_id = $1 AND status IN ('current', 'overdue', 'partial')`, [customerId]);
            await db.update(customers).set({
                creditBalance: String(balResult.rows[0]?.total ?? '0'),
                updatedAt: sql `now()`,
            }).where(eq(customers.id, customerId));
        }
        // Calculate change for cash payments
        const cashPayment = paymentEntries.find((p) => p.method === 'cash');
        let change = 0;
        if (cashPayment && cashTendered) {
            change = cashTendered - (cashPayment.amount || 0);
        }
        else if (paymentMethod === 'cash' && cashTendered) {
            change = cashTendered - calcTotal;
        }
        res.status(201).json({
            id: invoice.id,
            total: invoice.total,
            status: invoice.status,
            paymentMethod: invoice.paymentMethod,
            change: Math.max(0, change),
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Error creating sale' });
    }
});
// GET / — list sales with filters
router.get('/', requirePermission('pos.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const filters = {
            from: req.query.from,
            to: req.query.to,
            status: req.query.status,
            method: req.query.method,
            q: req.query.q,
            page: req.query.page ? parseInt(req.query.page, 10) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
        };
        const result = await listSales(db, filters);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Error listing sales' });
    }
});
// GET /dashboard — daily dashboard
router.get('/dashboard', requirePermission('pos.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const rawDate = req.query.date;
        const date = (!rawDate || rawDate === 'today')
            ? new Date().toISOString().split('T')[0]
            : rawDate;
        const result = await getSalesDashboard(db, date);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Error loading dashboard' });
    }
});
// GET /summary — period summary
router.get('/summary', requirePermission('pos.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const from = req.query.from;
        const to = req.query.to;
        if (!from || !to) {
            return res.status(400).json({ error: 'Both "from" and "to" query parameters are required' });
        }
        const result = await getSalesSummary(db, from, to);
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Error loading summary' });
    }
});
// GET /:id — get full sale detail (must be AFTER /dashboard and /summary to avoid capturing those as :id)
router.get('/:id', requirePermission('pos.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const pool = req.app.get('pool');
        const { id } = req.params;
        // Avoid matching non-UUID routes like "dashboard" or "summary"
        if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            return res.status(400).json({ error: 'Invalid sale ID' });
        }
        const result = await getSaleDetail(db, pool, id);
        if (!result) {
            return res.status(404).json({ error: 'Venta no encontrada' });
        }
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Error fetching sale detail' });
    }
});
export default router;
//# sourceMappingURL=sales.routes.js.map