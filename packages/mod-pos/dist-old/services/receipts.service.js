import { invoices, invoiceItems, customers } from '@enlocal/core-db';
import { eq, sql } from 'drizzle-orm';
/**
 * Ensure payments table exists for querying.
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
    await db.execute(sql `
    DO $$ BEGIN
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_id uuid;
      ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_abono boolean NOT NULL DEFAULT false;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$;
  `);
}
async function getReceiptData(db, orderId) {
    await ensurePaymentsTable(db);
    // Get the invoice
    const invoiceResult = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, orderId))
        .limit(1);
    if (!invoiceResult.length) {
        throw new Error('Invoice not found');
    }
    const invoice = invoiceResult[0];
    // Get customer if exists
    let customer = null;
    if (invoice.customerId) {
        const customerResult = await db
            .select({ id: customers.id, name: customers.name })
            .from(customers)
            .where(eq(customers.id, invoice.customerId))
            .limit(1);
        if (customerResult.length) {
            customer = customerResult[0];
        }
    }
    // Get invoice items with product names
    const itemsResult = await db
        .select({
        description: invoiceItems.description,
        quantity: invoiceItems.quantity,
        unitPrice: invoiceItems.unitPrice,
        amount: invoiceItems.amount,
        discount: invoiceItems.discount,
    })
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, orderId));
    const items = itemsResult.map((r) => ({
        description: r.description,
        quantity: parseFloat(r.quantity),
        unitPrice: parseFloat(r.unitPrice),
        amount: parseFloat(r.amount),
        discount: parseFloat(r.discount ?? '0'),
    }));
    // Get payments
    const paymentsResult = await db.execute(sql `SELECT method, amount, reference, tip FROM payments WHERE invoice_id = ${orderId} AND amount > 0 ORDER BY created_at ASC`);
    const paymentRows = paymentsResult.rows ?? paymentsResult;
    const payments = paymentRows.map((r) => ({
        method: r.method,
        amount: parseFloat(r.amount),
        reference: r.reference,
        tip: parseFloat(r.tip ?? '0'),
    }));
    const subtotal = parseFloat(invoice.subtotal ?? '0');
    const tax = parseFloat(invoice.tax ?? '0');
    const total = parseFloat(invoice.total ?? '0');
    const totalPaid = payments.reduce((sum, p) => sum + p.amount + p.tip, 0);
    const change = totalPaid > total ? Math.round((totalPaid - total) * 100) / 100 : 0;
    return {
        invoice: {
            id: invoice.id,
            series: invoice.series,
            folio: invoice.folio,
            status: invoice.status,
            currency: invoice.currency ?? 'MXN',
            createdAt: invoice.createdAt,
        },
        customer,
        items,
        subtotal,
        tax,
        total,
        payments,
        totalPaid,
        change,
    };
}
function padRight(str, len) {
    return str.length >= len ? str.substring(0, len) : str + ' '.repeat(len - str.length);
}
function padLeft(str, len) {
    return str.length >= len ? str.substring(0, len) : ' '.repeat(len - str.length) + str;
}
function formatMoney(value) {
    return `$${value.toFixed(2)}`;
}
function centerText(text, width) {
    if (text.length >= width)
        return text.substring(0, width);
    const leftPad = Math.floor((width - text.length) / 2);
    return ' '.repeat(leftPad) + text;
}
const RECEIPT_WIDTH = 40;
const SEPARATOR = '-'.repeat(RECEIPT_WIDTH);
const DOUBLE_SEPARATOR = '='.repeat(RECEIPT_WIDTH);
export async function generateReceipt(db, orderId) {
    const data = await getReceiptData(db, orderId);
    const lines = [];
    // Header
    lines.push(centerText('TICKET DE VENTA', RECEIPT_WIDTH));
    lines.push(SEPARATOR);
    lines.push(`Folio: ${data.invoice.series}-${data.invoice.folio}`);
    lines.push(`Fecha: ${new Date(data.invoice.createdAt).toLocaleString('es-MX')}`);
    if (data.customer) {
        lines.push(`Cliente: ${data.customer.name}`);
    }
    lines.push(SEPARATOR);
    // Column headers
    lines.push(padRight('Descripcion', 20) + padLeft('Cant', 6) + padLeft('Importe', 14));
    lines.push(SEPARATOR);
    // Items
    for (const item of data.items) {
        const desc = item.description.length > 20
            ? item.description.substring(0, 20)
            : item.description;
        const qty = item.quantity.toString();
        const amount = formatMoney(item.amount);
        lines.push(padRight(desc, 20) + padLeft(qty, 6) + padLeft(amount, 14));
        // Show unit price if quantity > 1
        if (item.quantity > 1) {
            lines.push(`  ${formatMoney(item.unitPrice)} c/u`);
        }
        // Show discount if any
        if (item.discount > 0) {
            lines.push(`  Desc: -${formatMoney(item.discount)}`);
        }
    }
    lines.push(SEPARATOR);
    // Totals
    lines.push(padRight('Subtotal:', 26) + padLeft(formatMoney(data.subtotal), 14));
    lines.push(padRight('IVA:', 26) + padLeft(formatMoney(data.tax), 14));
    lines.push(DOUBLE_SEPARATOR);
    lines.push(padRight('TOTAL:', 26) + padLeft(formatMoney(data.total), 14));
    lines.push(DOUBLE_SEPARATOR);
    // Payments
    lines.push('');
    lines.push('Forma de pago:');
    for (const payment of data.payments) {
        const methodLabel = getMethodLabel(payment.method);
        lines.push(padRight(`  ${methodLabel}:`, 26) + padLeft(formatMoney(payment.amount), 14));
        if (payment.tip > 0) {
            lines.push(padRight('  Propina:', 26) + padLeft(formatMoney(payment.tip), 14));
        }
        if (payment.reference) {
            lines.push(`  Ref: ${payment.reference}`);
        }
    }
    if (data.change > 0) {
        lines.push(padRight('  Cambio:', 26) + padLeft(formatMoney(data.change), 14));
    }
    // Footer
    lines.push('');
    lines.push(SEPARATOR);
    lines.push(centerText('Gracias por su compra', RECEIPT_WIDTH));
    lines.push(centerText(`Moneda: ${data.invoice.currency}`, RECEIPT_WIDTH));
    lines.push('');
    return lines.join('\n');
}
function getMethodLabel(method) {
    switch (method) {
        case 'cash': return 'Efectivo';
        case 'card': return 'Tarjeta';
        case 'transfer': return 'Transferencia';
        case 'credit': return 'Credito';
        default: return method;
    }
}
export async function getReceiptPreview(db, orderId) {
    return getReceiptData(db, orderId);
}
/**
 * Generate a receipt for an abono payment.
 */
export async function generateAbonoReceipt(db, pool, paymentId) {
    // Fetch the abono payment
    const paymentResult = await pool.query(`SELECT p.*, i.total::numeric as invoice_total, i.folio, i.series, i.customer_id,
            c.name as customer_name
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     LEFT JOIN customers c ON i.customer_id = c.id
     WHERE p.id = $1 AND p.is_abono = true`, [paymentId]);
    if (!paymentResult.rows.length) {
        throw new Error('Abono payment not found');
    }
    const payment = paymentResult.rows[0];
    // Calculate total paid and balance
    const paidResult = await pool.query(`SELECT coalesce(sum(amount), 0)::numeric as total_paid
     FROM payments WHERE invoice_id = $1 AND amount > 0 AND method != 'credit'`, [payment.invoice_id]);
    const totalPaid = parseFloat(paidResult.rows[0]?.total_paid ?? '0');
    const invoiceTotal = parseFloat(payment.invoice_total);
    const balance = Math.max(0, invoiceTotal - totalPaid);
    const lines = [];
    lines.push(centerText('RECIBO DE ABONO', RECEIPT_WIDTH));
    lines.push(SEPARATOR);
    lines.push(`Folio venta: ${payment.series || ''}-${payment.folio || ''}`);
    lines.push(`Fecha: ${new Date(payment.created_at).toLocaleString('es-MX')}`);
    if (payment.customer_name) {
        lines.push(`Cliente: ${payment.customer_name}`);
    }
    lines.push(SEPARATOR);
    lines.push(padRight('Total factura:', 26) + padLeft(formatMoney(invoiceTotal), 14));
    lines.push(padRight('Abono aplicado:', 26) + padLeft(formatMoney(parseFloat(payment.amount)), 14));
    lines.push(padRight(`  ${getMethodLabel(payment.method)}:`, 26) + padLeft(formatMoney(parseFloat(payment.amount)), 14));
    if (payment.reference) {
        lines.push(`  Ref: ${payment.reference}`);
    }
    lines.push(SEPARATOR);
    lines.push(padRight('Total pagado:', 26) + padLeft(formatMoney(totalPaid), 14));
    lines.push(padRight('Saldo pendiente:', 26) + padLeft(formatMoney(balance), 14));
    lines.push(DOUBLE_SEPARATOR);
    lines.push('');
    lines.push(centerText('Gracias por su pago', RECEIPT_WIDTH));
    lines.push('');
    return lines.join('\n');
}
//# sourceMappingURL=receipts.service.js.map