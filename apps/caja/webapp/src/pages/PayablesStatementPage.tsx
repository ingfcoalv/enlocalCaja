import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { usePayableStore } from '../stores/usePayableStore';

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return isNaN(n) ? '$0.00' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}
const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PayablesStatementPage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const { supplierStatement, fetchSupplierStatement } = usePayableStore();

  useEffect(() => {
    if (supplierId) {
      fetchSupplierStatement(supplierId);
    }
  }, [supplierId, fetchSupplierStatement]);

  const entries = useMemo(() => {
    if (!supplierStatement?.payables) return [];

    const result: Array<{
      date: string;
      concept: string;
      charge: number;
      credit: number;
      balance: number;
    }> = [];

    let runningBalance = 0;

    supplierStatement.payables
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach((payable) => {
        const charge = payable.originalAmount;
        const credit = payable.amountPaid + (payable.adjustments || 0);
        runningBalance += charge - credit;

        result.push({
          date: payable.createdAt,
          concept: payable.invoiceNumber || `CxP-${payable.id}`,
          charge,
          credit,
          balance: runningBalance,
        });
      });

    return result;
  }, [supplierStatement]);

  const total = entries.length > 0 ? entries[entries.length - 1].balance : 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <FileText className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">Estado de Cuenta - Proveedor</h1>
      </div>

      {supplierStatement && (
        <div className="mb-6 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {supplierStatement.name}
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">RFC:</span>{' '}
              <span className="text-gray-900">{supplierStatement.rfc || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500">Teléfono:</span>{' '}
              <span className="text-gray-900">{supplierStatement.phone || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Concepto
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cargo
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Abono
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {fmtDate(entry.date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.concept}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {entry.charge > 0 ? fmtMoney(entry.charge) : ''}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {entry.credit > 0 ? fmtMoney(entry.credit) : ''}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                  {fmtMoney(entry.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr>
              <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                SALDO TOTAL
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                {fmtMoney(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
