import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { usePayableStore } from '../stores/usePayableStore';

const fmtMoney = (v: string | number) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return isNaN(n) ? '$0.00' : n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}
const fmtDate = (d: string) => {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PayablesSchedulePage() {
  const { paymentSchedule, fetchPaymentSchedule } = usePayableStore();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const from = today.toISOString().split('T')[0];
    const to = thirtyDaysLater.toISOString().split('T')[0];

    setFromDate(from);
    setToDate(to);

    fetchPaymentSchedule(from, to);
  }, [fetchPaymentSchedule]);

  const handleFilter = () => {
    if (fromDate && toDate) {
      fetchPaymentSchedule(fromDate, toDate);
    }
  };

  const sortedSchedule = [...paymentSchedule].sort((a, b) => {
    const dateCompare = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (dateCompare !== 0) return dateCompare;
    return (b.priority || 0) - (a.priority || 0);
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Calendar className="h-8 w-8 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">Calendario de Pagos</h1>
      </div>

      <div className="mb-6 bg-white rounded-lg shadow p-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Desde
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {fromDate && <p className="mt-1 text-xs text-gray-500">{fmtDate(fromDate)}</p>}
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hasta
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {toDate && <p className="mt-1 text-xs text-gray-500">{fmtDate(toDate)}</p>}
          </div>
          <button
            onClick={handleFilter}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Filtrar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha de Vencimiento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Proveedor
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Saldo
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prioridad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Método de Pago
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedSchedule.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {fmtDate(item.dueDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.supplierName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                  {fmtMoney(item.balance)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      (item.priority || 0) >= 3
                        ? 'bg-red-100 text-red-800'
                        : (item.priority || 0) >= 2
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {item.priority || 0}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.paymentMethod || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
