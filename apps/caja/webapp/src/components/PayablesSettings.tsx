import { useEffect, useState } from 'react';
import { Hash, DollarSign, Save } from 'lucide-react';
import { api, useToast } from '@enlocal/react-hooks';

interface FolioConfig {
  series: string;
  currentFolio: number;
  startingFolio: number;
}

export function PayablesSettings() {
  const { showToast } = useToast();

  const [purchaseFolio, setPurchaseFolio] = useState<FolioConfig>({
    series: 'OC',
    currentFolio: 1,
    startingFolio: 1,
  });

  const [receiptFolio, setReceiptFolio] = useState<FolioConfig>({
    series: 'REC',
    currentFolio: 1,
    startingFolio: 1,
  });

  const [returnFolio, setReturnFolio] = useState<FolioConfig>({
    series: 'DEV',
    currentFolio: 1,
    startingFolio: 1,
  });

  const [paymentThreshold, setPaymentThreshold] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [purchaseRes, receiptRes, returnRes, thresholdRes] = await Promise.all([
        api.get('/api/payables-config/purchase-folio'),
        api.get('/api/payables-config/receipt-folio'),
        api.get('/api/payables-config/return-folio'),
        api.get('/api/payables-config/payment-threshold'),
      ]);

      if (purchaseRes.ok && purchaseRes.data) {
        setPurchaseFolio(purchaseRes.data);
      }
      if (receiptRes.ok && receiptRes.data) {
        setReceiptFolio(receiptRes.data);
      }
      if (returnRes.ok && returnRes.data) {
        setReturnFolio(returnRes.data);
      }
      if (thresholdRes.ok && thresholdRes.data) {
        setPaymentThreshold(thresholdRes.data.threshold || 0);
      }
    } catch (error) {
      showToast('Error al cargar configuración', 'error');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const [purchaseRes, receiptRes, returnRes, thresholdRes] = await Promise.all([
        api.put('/api/payables-config/purchase-folio', {
          startingFolio: purchaseFolio.startingFolio,
        }),
        api.put('/api/payables-config/receipt-folio', {
          startingFolio: receiptFolio.startingFolio,
        }),
        api.put('/api/payables-config/return-folio', {
          startingFolio: returnFolio.startingFolio,
        }),
        api.put('/api/payables-config/payment-threshold', {
          threshold: paymentThreshold,
        }),
      ]);

      if (purchaseRes.ok && receiptRes.ok && returnRes.ok && thresholdRes.ok) {
        showToast('Configuración guardada exitosamente', 'success');
        loadSettings();
      } else {
        showToast('Error al guardar configuración', 'error');
      }
    } catch (error) {
      showToast('Error al guardar configuración', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Hash className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Configuración de Folios</h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4 items-center border-b border-gray-200 pb-2">
            <div className="text-sm font-medium text-gray-700">Tipo</div>
            <div className="text-sm font-medium text-gray-700">Serie</div>
            <div className="text-sm font-medium text-gray-700">Folio Actual</div>
            <div className="text-sm font-medium text-gray-700">Folio Inicial</div>
          </div>

          <div className="grid grid-cols-4 gap-4 items-center">
            <div className="text-sm text-gray-900">Orden de Compra</div>
            <div>
              <input
                type="text"
                value={purchaseFolio.series}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <input
                type="number"
                value={purchaseFolio.currentFolio}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <input
                type="number"
                value={purchaseFolio.startingFolio}
                onChange={(e) =>
                  setPurchaseFolio({ ...purchaseFolio, startingFolio: parseInt(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 items-center">
            <div className="text-sm text-gray-900">Recepción</div>
            <div>
              <input
                type="text"
                value={receiptFolio.series}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <input
                type="number"
                value={receiptFolio.currentFolio}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <input
                type="number"
                value={receiptFolio.startingFolio}
                onChange={(e) =>
                  setReceiptFolio({ ...receiptFolio, startingFolio: parseInt(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 items-center">
            <div className="text-sm text-gray-900">Devolución</div>
            <div>
              <input
                type="text"
                value={returnFolio.series}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <input
                type="number"
                value={returnFolio.currentFolio}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <input
                type="number"
                value={returnFolio.startingFolio}
                onChange={(e) =>
                  setReturnFolio({ ...returnFolio, startingFolio: parseInt(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Umbral de Pago</h2>
        </div>

        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Monto mínimo para autorización
          </label>
          <input
            type="number"
            value={paymentThreshold}
            onChange={(e) => setPaymentThreshold(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            step="0.01"
          />
          <p className="mt-2 text-sm text-gray-500">
            Los pagos superiores a este monto requerirán autorización adicional
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          {loading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
