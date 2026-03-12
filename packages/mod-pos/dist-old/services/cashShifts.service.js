import { sql } from 'drizzle-orm';
/**
 * Ensures the cash_shifts table exists. Called before operations.
 */
async function ensureTable(db) {
    await db.execute(sql `
    CREATE TABLE IF NOT EXISTS cash_shifts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      opening_amount numeric(12,2) NOT NULL DEFAULT 0,
      closing_amount numeric(12,2),
      expected_amount numeric(12,2),
      difference numeric(12,2),
      status text NOT NULL DEFAULT 'open',
      opened_at timestamptz NOT NULL DEFAULT now(),
      closed_at timestamptz,
      notes text
    )
  `);
}
function mapRow(row) {
    return {
        id: row.id,
        userId: row.user_id,
        openingAmount: row.opening_amount,
        closingAmount: row.closing_amount,
        expectedAmount: row.expected_amount,
        difference: row.difference,
        status: row.status,
        openedAt: row.opened_at,
        closedAt: row.closed_at,
        notes: row.notes,
    };
}
export async function getCurrentShift(db, userId) {
    await ensureTable(db);
    const result = await db.execute(sql `SELECT * FROM cash_shifts WHERE user_id = ${userId} AND status = 'open' ORDER BY opened_at DESC LIMIT 1`);
    const rows = result.rows ?? result;
    if (!rows.length)
        return null;
    return mapRow(rows[0]);
}
export async function openShift(db, userId, openingAmount) {
    await ensureTable(db);
    // Check if there is already an open shift for this user
    const existing = await getCurrentShift(db, userId);
    if (existing) {
        throw new Error('User already has an open shift. Close the current shift before opening a new one.');
    }
    const result = await db.execute(sql `INSERT INTO cash_shifts (user_id, opening_amount, status, opened_at)
        VALUES (${userId}, ${openingAmount}, 'open', now())
        RETURNING *`);
    const rows = result.rows ?? result;
    return mapRow(rows[0]);
}
export async function closeShift(db, shiftId, closingAmount, notes) {
    await ensureTable(db);
    // Ensure the payments table exists before querying it
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
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
    // Verify shift exists and is open
    const shiftResult = await db.execute(sql `SELECT * FROM cash_shifts WHERE id = ${shiftId} AND status = 'open'`);
    const shiftRows = shiftResult.rows ?? shiftResult;
    if (!shiftRows.length) {
        throw new Error('Shift not found or already closed');
    }
    const shift = shiftRows[0];
    // Calculate expected amount: opening + cash payments received during this shift
    const paymentsResult = await db.execute(sql `SELECT coalesce(sum(amount), 0)::numeric as total_cash
        FROM payments
        WHERE shift_id = ${shiftId} AND method = 'cash'`);
    const paymentsRows = paymentsResult.rows ?? paymentsResult;
    const totalCashPayments = parseFloat(paymentsRows[0]?.total_cash ?? '0');
    const openingAmount = parseFloat(shift.opening_amount);
    const expectedAmount = openingAmount + totalCashPayments;
    const difference = closingAmount - expectedAmount;
    const updateResult = await db.execute(sql `UPDATE cash_shifts
        SET closing_amount = ${closingAmount},
            expected_amount = ${expectedAmount},
            difference = ${difference},
            status = 'closed',
            closed_at = now(),
            notes = ${notes}
        WHERE id = ${shiftId}
        RETURNING *`);
    const updateRows = updateResult.rows ?? updateResult;
    return mapRow(updateRows[0]);
}
export async function getShiftHistory(db, filters) {
    await ensureTable(db);
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;
    const result = await db.execute(sql `SELECT * FROM cash_shifts
        WHERE status = 'closed'
        ORDER BY closed_at DESC
        LIMIT ${limit} OFFSET ${offset}`);
    const countResult = await db.execute(sql `SELECT count(*)::int as count FROM cash_shifts WHERE status = 'closed'`);
    const rows = result.rows ?? result;
    const countRows = countResult.rows ?? countResult;
    const total = countRows[0]?.count ?? 0;
    return {
        data: rows.map(mapRow),
        total,
        page,
        pages: Math.ceil(total / limit),
    };
}
//# sourceMappingURL=cashShifts.service.js.map