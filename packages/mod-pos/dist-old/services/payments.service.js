import { invoices, changeJournal } from '@enlocal/core-db';
import { eq, sql } from 'drizzle-orm';
function mapPaymentRow(row) {
    return {
        id: row.id,
        invoiceId: row.invoice_id,
        method: row.method,
        amount: row.amount,
        reference: row.reference,
        tip: row.tip,
        shiftId: row.shift_id,
        userId: row.user_id,
        createdAt: row.created_at,
    };
}
/**
 * Ensures the payments table exists. Called before operations.
 */
async function ensurePaymentsTable(db) {
    await db.execute(sql `
    CREATE TABLE IF NOT EXISTS payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id uuid,
      method text NOT NULL DEFAULT 'cash',
      amount numeric(12,2) NOT NULL DEFAULT 0,
      reference text,
      tip numeric(12,2) NOT NULL DEFAULT 0,
      shift_id uuid,
      user_id uuid,
      customer_id uuid,
      is_abono boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
    // Add columns if they don't exist (for existing installations)
    await db.execute(sql `
    DO $$ BEGIN
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_id uuid;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_abono boolean NOT NULL DEFAULT false;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;
  `);
}
export async function createPayment(db, data, userId, shiftId) {
    await ensurePaymentsTable(db);
    // Validate that the invoice exists
    const invoiceResult = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, data.invoiceId))
        .limit(1);
    if (!invoiceResult.length) {
        throw new Error('Invoice not found');
    }
    const invoice = invoiceResult[0];
    if (invoice.status === 'paid') {
        throw new Error('Invoice is already fully paid');
    }
    // Insert all payment entries
    const insertedPayments = [];
    for (const payment of data.payments) {
        const result = await db.execute(sql `INSERT INTO payments (invoice_id, method, amount, reference, tip, shift_id, user_id, created_at)
          VALUES (${data.invoiceId}, ${payment.method}, ${payment.amount}, ${payment.reference ?? null}, ${payment.tip ?? 0}, ${shiftId}, ${userId}, now())
          RETURNING *`);
        const rows = result.rows ?? result;
        if (rows.length) {
            insertedPayments.push(mapPaymentRow(rows[0]));
        }
    }
    // Calculate total paid so far for this invoice
    const paidResult = await db.execute(sql `SELECT coalesce(sum(amount), 0)::numeric as total_paid
        FROM payments
        WHERE invoice_id = ${data.invoiceId} AND amount > 0`);
    const paidRows = paidResult.rows ?? paidResult;
    const totalPaid = parseFloat(paidRows[0]?.total_paid ?? '0');
    const invoiceTotal = parseFloat(invoice.total);
    // Update invoice status if fully paid
    let updatedInvoice = invoice;
    if (totalPaid >= invoiceTotal) {
        const [updated] = await db
            .update(invoices)
            .set({ status: 'paid', updatedAt: sql `now()` })
            .where(eq(invoices.id, data.invoiceId))
            .returning();
        updatedInvoice = updated || invoice;
        // Log to change journal
        await db.insert(changeJournal).values({
            tableName: 'invoices',
            recordId: data.invoiceId,
            action: 'update',
            data: updatedInvoice,
            userId,
            synced: false,
        });
    }
    return {
        payments: insertedPayments,
        invoice: updatedInvoice,
    };
}
export async function refundPayment(db, paymentId, amount, reason, userId) {
    await ensurePaymentsTable(db);
    // Find the original payment
    const paymentResult = await db.execute(sql `SELECT * FROM payments WHERE id = ${paymentId}`);
    const paymentRows = paymentResult.rows ?? paymentResult;
    if (!paymentRows.length) {
        throw new Error('Payment not found');
    }
    const originalPayment = paymentRows[0];
    const originalAmount = parseFloat(originalPayment.amount);
    if (amount > originalAmount) {
        throw new Error('Refund amount cannot exceed original payment amount');
    }
    // Create a negative payment entry for the refund
    const refundResult = await db.execute(sql `INSERT INTO payments (invoice_id, method, amount, reference, tip, shift_id, user_id, created_at)
        VALUES (${originalPayment.invoice_id}, ${originalPayment.method}, ${-amount}, ${reason}, 0, ${originalPayment.shift_id}, ${userId}, now())
        RETURNING *`);
    const refundRows = refundResult.rows ?? refundResult;
    const refund = mapPaymentRow(refundRows[0]);
    // Recalculate total paid for the invoice
    const paidResult = await db.execute(sql `SELECT coalesce(sum(amount), 0)::numeric as total_paid
        FROM payments
        WHERE invoice_id = ${originalPayment.invoice_id}`);
    const paidRows = paidResult.rows ?? paidResult;
    const totalPaid = parseFloat(paidRows[0]?.total_paid ?? '0');
    // Get the invoice
    const invoiceResult = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, originalPayment.invoice_id))
        .limit(1);
    let updatedInvoice = invoiceResult[0];
    const invoiceTotal = parseFloat(updatedInvoice.total);
    // If total paid is now less than invoice total, revert status to draft
    if (totalPaid < invoiceTotal && updatedInvoice.status === 'paid') {
        const [updated] = await db
            .update(invoices)
            .set({ status: 'draft', updatedAt: sql `now()` })
            .where(eq(invoices.id, originalPayment.invoice_id))
            .returning();
        updatedInvoice = updated || updatedInvoice;
        await db.insert(changeJournal).values({
            tableName: 'invoices',
            recordId: originalPayment.invoice_id,
            action: 'update',
            data: updatedInvoice,
            userId,
            synced: false,
        });
    }
    return {
        refund,
        invoice: updatedInvoice,
    };
}
//# sourceMappingURL=payments.service.js.map