-- Align credit_status values: 'good' → 'active', 'blocked' → 'suspended'
UPDATE customers SET credit_status = 'active' WHERE credit_status = 'good';
UPDATE customers SET credit_status = 'suspended' WHERE credit_status = 'blocked';
