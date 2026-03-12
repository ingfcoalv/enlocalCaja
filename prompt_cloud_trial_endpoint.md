# Implementar Endpoint de Trial en todoenlocal.com Cloud (MongoDB)

## Contexto

La plataforma todoenlocal.com usa **MongoDB** y ya tiene endpoints para licencias de software desktop:

- `POST /api/v1/licenses/activate` — Activa licencia con serial + hardware fingerprint
- `POST /api/v1/licenses/validate` — Valida licencia con terminal_token + hardware fingerprint

Ahora necesitamos agregar un sistema de **trial de 15 dias** para que los usuarios prueben cualquier producto (Caja, Comanda Pro, Facturacion, ERP, Servicios, Nominas) sin comprar licencia. El trial es **por producto por equipo** — un usuario puede probar Caja 15 dias Y Comanda 15 dias en el mismo equipo, pero solo 1 trial por producto por equipo.

---

## Productos existentes

Los codigos de producto que ya existen en el sistema (coleccion `products` o similar, revisa — creo que el campo se llama `product_code` o `code`):

| product_code | Nombre |
|---|---|
| `enlocal_caja` | enLocal Caja |
| `enlocal_comanda` | enLocal Comanda Pro |
| `enlocal_facturacion` | enLocal Facturacion |
| `enlocal_erp` | enLocal ERP |
| `enlocal_servicios` | enLocal Servicios |
| `enlocal_nominas` | enLocal Nominas |

---

## 1. Modelo Mongoose: `DesktopTrial`

Crear el schema y modelo para registrar trials:

```javascript
const mongoose = require('mongoose'); // o import si usas ESM

const desktopTrialSchema = new mongoose.Schema({
  hardware_fingerprint: {
    type: String,
    required: true,
    index: true,
  },
  hardware_details: {
    hostname: String,
    os_version: String,
    cpu_id: String,
    mac_address: String,
    disk_serial: String,
  },
  product_code: {
    type: String,
    required: true,
    index: true,
  },
  pos_version: {
    type: String,
  },
  terminal_token: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  started_at: {
    type: Date,
    required: true,
    default: Date.now,
  },
  ends_at: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'converted'],
    default: 'active',
    index: true,
  },
  converted_license_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'License', // adapta al nombre real de tu modelo de licencias
    default: null,
  },
  ip_address: {
    type: String,
  },
}, {
  timestamps: true, // crea createdAt y updatedAt automaticamente
});

// Un trial por producto por hardware — indice compuesto unico
desktopTrialSchema.index(
  { hardware_fingerprint: 1, product_code: 1 },
  { unique: true }
);

const DesktopTrial = mongoose.model('DesktopTrial', desktopTrialSchema);
module.exports = DesktopTrial;
```

**Nota:** Adapta `ref: 'License'` al nombre real de tu modelo de licencias (puede ser `License`, `DesktopLicense`, etc.). Revisa tus modelos existentes.

---

## 2. Endpoint: `POST /api/v1/pos/desktop/trial`

### Request

```json
{
  "hardware_fingerprint": "sha256_del_hardware",
  "hardware_details": {
    "hostname": "PC-RESTAURANTE",
    "os_version": "win32 10.0.19045",
    "cpu_id": "BFEBFBFF000906A3",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "disk_serial": "WD-ABC123"
  },
  "product_code": "enlocal_comanda",
  "pos_version": "1.3.0"
}
```

### Logica del endpoint

```
1. Validar que product_code sea un producto valido
   → Buscar en coleccion products: Product.findOne({ code: product_code }) o como se llame el campo
   → Si no existe → retornar 400

2. Buscar trial existente:
   → DesktopTrial.findOne({ hardware_fingerprint, product_code })

3. SI existe trial:
   a. SI status = 'active' Y ends_at > new Date():
      → Retornar 200 con trial existente (reinstalacion, recupera sus dias)
   b. SI status = 'expired' O ends_at <= new Date():
      → Si status no es 'expired', actualizarlo:
        trial.status = 'expired'; await trial.save();
      → Retornar 409 (trial ya expirado)
   c. SI status = 'converted':
      → Retornar 409 (ya tiene licencia, debe usar activate)

4. SI NO existe trial:
   → Crear nuevo:
     const now = new Date();
     const endsAt = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
     const token = 'tt_trial_' + new mongoose.Types.ObjectId().toHexString();

     const trial = await DesktopTrial.create({
       hardware_fingerprint,
       hardware_details,
       product_code,
       pos_version,
       terminal_token: token,
       started_at: now,
       ends_at: endsAt,
       status: 'active',
       ip_address: req.ip || req.headers['x-forwarded-for'],
     });
   → Retornar 200 con trial nuevo
```

### Response 200 — Trial activo (nuevo o existente)

```json
{
  "message": "Trial registrado exitosamente",
  "trial": {
    "id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "hardware_fingerprint": "sha256_del_hardware",
    "product_code": "enlocal_comanda",
    "started_at": "2026-02-26T10:00:00.000Z",
    "ends_at": "2026-03-13T10:00:00.000Z",
    "status": "active"
  },
  "terminal_token": "tt_trial_65f1a2b3c4d5e6f7a8b9c0d1"
}
```

Para reinstalaciones (trial activo existente), usar el mismo formato pero mensaje diferente:

```json
{
  "message": "Trial activo recuperado",
  "trial": { "...mismo objeto..." },
  "terminal_token": "tt_trial_65f1a2b3c4d5e6f7a8b9c0d1"
}
```

Retorna el **mismo terminal_token** que se genero originalmente. No crear uno nuevo.

### Response 409 — Trial expirado

```json
{
  "message": "Este equipo ya utilizó el periodo de prueba para este producto.",
  "trial": {
    "id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "started_at": "2026-02-10T10:00:00.000Z",
    "ends_at": "2026-02-25T10:00:00.000Z",
    "status": "expired"
  }
}
```

### Response 409 — Trial convertido (ya tiene licencia)

```json
{
  "message": "Este equipo ya tiene una licencia activa para este producto.",
  "trial": {
    "id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "status": "converted"
  }
}
```

### Response 400 — Producto invalido

```json
{
  "message": "Producto no válido",
  "detail": "El código de producto 'xxx' no existe"
}
```

---

## 3. Modificar `POST /api/v1/licenses/validate`

El endpoint de validacion ya existe y recibe:

```
POST /api/v1/licenses/validate?terminal_token=xxx&hardware_fingerprint=yyy&product_code=zzz
```

Actualmente solo busca en la coleccion `licenses`/`terminals`. Necesita **tambien reconocer trial tokens**.

### Logica adicional

```
1. Recibir terminal_token

2. SI el token empieza con "tt_trial_":
   a. Buscar en DesktopTrial:
      const trial = await DesktopTrial.findOne({ terminal_token });
   b. SI no existe → retornar 404
   c. SI existe:
      - Verificar que hardware_fingerprint coincida
        SI no coincide → retornar 403 { message: "Hardware fingerprint no coincide" }
      - SI status = 'active' Y ends_at > new Date():
        → Retornar 200 con valid=true, license.status='trial', license.pos_type='trial'
      - SI status = 'expired' O ends_at <= new Date():
        → Si status no es 'expired':
          trial.status = 'expired'; await trial.save();
        → Retornar 200 con valid=false, license.status='trial_expired'
      - SI status = 'converted':
        → Buscar la licencia convertida por converted_license_id
        → Validar esa licencia normalmente (misma logica que licencia regular)

3. SI NO empieza con "tt_trial_":
   → Continuar con la logica existente de licencias (sin cambios)
```

### Response 200 para trial activo

```json
{
  "valid": true,
  "license": {
    "id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "serial_number": null,
    "status": "trial",
    "pos_type": "trial",
    "product_id": "product-object-id",
    "business_id": null,
    "branch_id": null,
    "terminal_id": null,
    "valid_until": "2026-03-13T10:00:00.000Z",
    "last_seen": "2026-02-26T15:00:00.000Z"
  },
  "business": null,
  "branch": null,
  "terminal": null,
  "product": {
    "id": "product-object-id",
    "code": "enlocal_comanda",
    "name": "enLocal Comanda Pro"
  },
  "is_linked": false,
  "addons": [],
  "stamps_available": 0,
  "max_terminals": 1
}
```

**Importante:** El campo `product` debe ser un objeto con `id`, `code` y `name` — busca el producto en la coleccion products para llenar estos datos. Asi el cliente sabe que producto es.

### Response 200 para trial expirado

```json
{
  "valid": false,
  "license": {
    "id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "status": "trial_expired",
    "pos_type": "trial",
    "valid_until": "2026-02-25T10:00:00.000Z"
  }
}
```

---

## 4. Cuando un trial se convierte en licencia

Cuando un usuario con trial activo compra una licencia y la activa (`POST /api/v1/licenses/activate`), el sistema debe:

1. En el endpoint de activacion, despues de crear la licencia exitosamente, buscar si hay un trial activo para ese `hardware_fingerprint` + `product_code`
2. Si existe → marcarlo como `converted` y guardar referencia a la licencia

Agregar al final del flujo de `activate`:

```javascript
// Despues de crear/activar la licencia exitosamente
const trial = await DesktopTrial.findOne({
  hardware_fingerprint: hardware_fingerprint,
  product_code: product_code,
  status: 'active',
});

if (trial) {
  trial.status = 'converted';
  trial.converted_license_id = nuevaLicencia._id; // el ObjectId de la licencia recien creada/activada
  await trial.save();
}
```

Esto es para tracking — saber cuantos trials se convierten en ventas.

---

## 5. Cron Job: Expirar trials vencidos

Crear un job (con node-cron, agenda, o el scheduler que uses) que corra 1 vez al dia:

```javascript
// Cron: expirar trials vencidos — ejecutar diariamente
const result = await DesktopTrial.updateMany(
  {
    status: 'active',
    ends_at: { $lte: new Date() },
  },
  {
    $set: { status: 'expired' },
  }
);
console.log(`[CRON] Trials expirados: ${result.modifiedCount}`);
```

No es critico — la app cliente chequea `ends_at` localmente. Pero mantiene la coleccion limpia para consultas de admin.

---

## 6. Dashboard / Admin (opcional pero recomendado)

Agregar una seccion al admin de todoenlocal.com para ver trials:

- **Lista de trials** con filtros por producto, status, fecha
- **Metricas**: trials activos, expirados, tasa de conversion a licencia
- **Detalle por hardware**: ver todos los trials de un equipo

### Aggregations para metricas

```javascript
// Trials activos por producto
const activosPorProducto = await DesktopTrial.aggregate([
  {
    $match: {
      status: 'active',
      ends_at: { $gt: new Date() },
    },
  },
  {
    $group: {
      _id: '$product_code',
      total: { $sum: 1 },
    },
  },
]);

// Tasa de conversion por producto
const tasaConversion = await DesktopTrial.aggregate([
  {
    $group: {
      _id: '$product_code',
      total_trials: { $sum: 1 },
      conversiones: {
        $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] },
      },
    },
  },
  {
    $addFields: {
      tasa_conversion: {
        $round: [
          { $multiply: [{ $divide: ['$conversiones', '$total_trials'] }, 100] },
          1,
        ],
      },
    },
  },
]);

// Trials por dia (ultimos 30 dias)
const hace30Dias = new Date();
hace30Dias.setDate(hace30Dias.getDate() - 30);

const trialsPorDia = await DesktopTrial.aggregate([
  {
    $match: {
      createdAt: { $gte: hace30Dias },
    },
  },
  {
    $group: {
      _id: {
        dia: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        product_code: '$product_code',
      },
      total: { $sum: 1 },
    },
  },
  { $sort: { '_id.dia': -1 } },
]);

// Resumen general
const resumen = await DesktopTrial.aggregate([
  {
    $facet: {
      activos: [
        { $match: { status: 'active', ends_at: { $gt: new Date() } } },
        { $count: 'total' },
      ],
      expirados: [
        { $match: { status: 'expired' } },
        { $count: 'total' },
      ],
      convertidos: [
        { $match: { status: 'converted' } },
        { $count: 'total' },
      ],
      total: [
        { $count: 'total' },
      ],
    },
  },
]);
```

---

## Resumen de cambios

| Que | Accion | Detalle |
|-----|--------|---------|
| Modelo `DesktopTrial` | **CREAR** | Schema Mongoose con indice unico `(hardware_fingerprint, product_code)` |
| `POST /api/v1/pos/desktop/trial` | **CREAR** | Registra trial nuevo o retorna existente |
| `POST /api/v1/licenses/validate` | **MODIFICAR** | Reconocer trial tokens (`tt_trial_*`) y retornar status trial/trial_expired |
| `POST /api/v1/licenses/activate` | **MODIFICAR** | Marcar trial como 'converted' al activar licencia |
| Cron job | **CREAR** | Expirar trials vencidos 1x/dia con `updateMany` |

## Generacion de terminal_token para trials

Usar un prefijo para distinguir trial tokens de tokens de licencia regular:

```
tt_trial_{objectId_hex}
```

Ejemplo: `tt_trial_65f1a2b3c4d5e6f7a8b9c0d1`

Generacion:

```javascript
const token = 'tt_trial_' + new mongoose.Types.ObjectId().toHexString();
```

Asi el endpoint de validate puede detectar rapidamente si es un trial token con `token.startsWith('tt_trial_')`.

## Seguridad

- **Rate limiting** en `POST /api/v1/pos/desktop/trial`: maximo 5 requests por IP por hora (para evitar abuse)
- **Validar hardware_fingerprint** sea un sha256 valido (64 chars hex): `/^[a-f0-9]{64}$/i`
- **No exponer** datos sensibles del hardware en respuestas — solo el fingerprint
- El trial token NO debe dar acceso a sync ni a datos cloud del negocio (`business_id`, `branch_id` son `null`)
- Manejar error de indice duplicado (code 11000) como caso de "trial ya existe" en lugar de error 500
