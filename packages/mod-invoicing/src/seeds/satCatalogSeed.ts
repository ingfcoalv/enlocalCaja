import { sql } from 'drizzle-orm'

export async function seedSatCatalogs(db: any): Promise<void> {
  console.log('[mod-invoicing] Seeding SAT catalogs...')

  // ─── Regímenes Fiscales SAT ────────────────────────────────
  const taxRegimes = [
    ['601', 'General de Ley Personas Morales', true, false],
    ['603', 'Personas Morales con Fines no Lucrativos', true, false],
    ['605', 'Sueldos y Salarios e Ingresos Asimilados a Salarios', false, true],
    ['606', 'Arrendamiento', false, true],
    ['607', 'Regimen de Enajenacion o Adquisicion de Bienes', false, true],
    ['608', 'Demas ingresos', false, true],
    ['610', 'Residentes en el Extranjero sin Establecimiento Permanente en Mexico', true, true],
    ['611', 'Ingresos por Dividendos (socios y accionistas)', false, true],
    ['612', 'Personas Fisicas con Actividades Empresariales y Profesionales', false, true],
    ['614', 'Ingresos por intereses', false, true],
    ['615', 'Regimen de los ingresos por obtencion de premios', false, true],
    ['616', 'Sin obligaciones fiscales', true, true],
    ['620', 'Sociedades Cooperativas de Produccion que optan por diferir sus ingresos', true, false],
    ['621', 'Incorporacion Fiscal', false, true],
    ['622', 'Actividades Agricolas, Ganaderas, Silvicolas y Pesqueras', true, true],
    ['623', 'Opcional para Grupos de Sociedades', true, false],
    ['624', 'Coordinados', true, false],
    ['625', 'Regimen de las Actividades Empresariales con ingresos a traves de Plataformas Tecnologicas', false, true],
    ['626', 'Regimen Simplificado de Confianza', true, true],
  ] as const

  for (const [code, desc, pm, pf] of taxRegimes) {
    await db.execute(sql`INSERT INTO sat_tax_regimes (code, description, persona_moral, persona_fisica) VALUES (${code}, ${desc}, ${pm}, ${pf}) ON CONFLICT (code) DO NOTHING`)
  }

  // ─── Usos de CFDI SAT ─────────────────────────────────────
  const cfdiUses = [
    ['G01', 'Adquisicion de mercancias', true, true],
    ['G02', 'Devoluciones, descuentos o bonificaciones', true, true],
    ['G03', 'Gastos en general', true, true],
    ['I01', 'Construcciones', true, true],
    ['I02', 'Mobiliario y equipo de oficina por inversiones', true, true],
    ['I03', 'Equipo de transporte', true, true],
    ['I04', 'Equipo de computo y accesorios', true, true],
    ['I05', 'Dados, troqueles, moldes, matrices y herramental', true, true],
    ['I06', 'Comunicaciones telefonicas', true, true],
    ['I07', 'Comunicaciones satelitales', true, true],
    ['I08', 'Otra maquinaria y equipo', true, true],
    ['D01', 'Honorarios medicos, dentales y gastos hospitalarios', false, true],
    ['D02', 'Gastos medicos por incapacidad o discapacidad', false, true],
    ['D03', 'Gastos funerales', false, true],
    ['D04', 'Donativos', false, true],
    ['D05', 'Intereses reales efectivamente pagados por creditos hipotecarios (casa habitacion)', false, true],
    ['D06', 'Aportaciones voluntarias al SAR', false, true],
    ['D07', 'Primas por seguros de gastos medicos', false, true],
    ['D08', 'Gastos de transportacion escolar obligatoria', false, true],
    ['D09', 'Depositos en cuentas para el ahorro, primas que tengan como base planes de pensiones', false, true],
    ['D10', 'Pagos por servicios educativos (colegiaturas)', false, true],
    ['S01', 'Sin efectos fiscales', true, true],
    ['CP01', 'Pagos', true, true],
    ['CN01', 'Nomina', false, true],
  ] as const

  for (const [code, desc, pm, pf] of cfdiUses) {
    await db.execute(sql`INSERT INTO sat_cfdi_uses (code, description, persona_moral, persona_fisica) VALUES (${code}, ${desc}, ${pm}, ${pf}) ON CONFLICT (code) DO NOTHING`)
  }

  // ─── Formas de Pago SAT ───────────────────────────────────
  const paymentForms = [
    ['01', 'Efectivo'], ['02', 'Cheque nominativo'], ['03', 'Transferencia electronica de fondos'],
    ['04', 'Tarjeta de credito'], ['05', 'Monedero electronico'], ['06', 'Dinero electronico'],
    ['08', 'Vales de despensa'], ['12', 'Dacion en pago'], ['13', 'Pago por subrogacion'],
    ['14', 'Pago por consignacion'], ['15', 'Condonacion'], ['17', 'Compensacion'],
    ['23', 'Novacion'], ['24', 'Confusion'], ['25', 'Remision de deuda'],
    ['26', 'Prescripcion o caducidad'], ['27', 'A satisfaccion del acreedor'],
    ['28', 'Tarjeta de debito'], ['29', 'Tarjeta de servicios'],
    ['30', 'Aplicacion de anticipos'], ['31', 'Intermediario pagos'], ['99', 'Por definir'],
  ] as const

  for (const [code, desc] of paymentForms) {
    await db.execute(sql`INSERT INTO sat_payment_forms (code, description) VALUES (${code}, ${desc}) ON CONFLICT (code) DO NOTHING`)
  }

  // ─── Claves de Unidad SAT (principales) ────────────────────
  const unitCodes = [
    ['H87', 'Pieza', 'Unidad individual'], ['E48', 'Servicio', 'Unidad de servicio'],
    ['KGM', 'Kilogramo', 'Unidad de masa'], ['LTR', 'Litro', 'Unidad de volumen'],
    ['MTR', 'Metro', 'Unidad de longitud'], ['MTK', 'Metro cuadrado', 'Unidad de area'],
    ['MTQ', 'Metro cubico', 'Unidad de volumen'], ['XBX', 'Caja', 'Caja contenedor'],
    ['XPK', 'Paquete', 'Paquete contenedor'], ['HUR', 'Hora', 'Unidad de tiempo'],
    ['DAY', 'Dia', 'Unidad de tiempo'], ['MON', 'Mes', 'Unidad de tiempo'],
    ['ANN', 'Anio', 'Unidad de tiempo'], ['ACT', 'Actividad', 'Unidad de actividad'],
    ['GRM', 'Gramo', 'Unidad de masa'], ['TNE', 'Tonelada', 'Unidad de masa'],
    ['XUN', 'Unidad', 'Unidad generica'], ['SET', 'Conjunto', 'Conjunto de elementos'],
    ['XKI', 'Kit', 'Kit de componentes'], ['EA', 'Elemento', 'Cada uno'],
  ] as const

  for (const [code, name, desc] of unitCodes) {
    await db.execute(sql`INSERT INTO sat_unit_codes (code, name, description) VALUES (${code}, ${name}, ${desc}) ON CONFLICT (code) DO NOTHING`)
  }

  // ─── Monedas SAT ──────────────────────────────────────────
  const currencies = [
    ['MXN', 'Peso Mexicano', 2], ['USD', 'Dolar Americano', 2], ['EUR', 'Euro', 2],
    ['GBP', 'Libra Esterlina', 2], ['CAD', 'Dolar Canadiense', 2], ['JPY', 'Yen Japones', 0],
    ['CHF', 'Franco Suizo', 2], ['CNY', 'Yuan Chino', 2], ['BRL', 'Real Brasileno', 2],
    ['XXX', 'Los codigos asignados para transacciones en que intervenga ninguna moneda', 0],
  ] as const

  for (const [code, desc, decimals] of currencies) {
    await db.execute(sql`INSERT INTO sat_currencies (code, description, decimals) VALUES (${code}, ${desc}, ${decimals}) ON CONFLICT (code) DO NOTHING`)
  }

  // ─── Tipos de Relación SAT ────────────────────────────────
  const relTypes = [
    ['01', 'Nota de credito de los documentos relacionados'],
    ['02', 'Nota de debito de los documentos relacionados'],
    ['03', 'Devolucion de mercancia sobre facturas o traslados previos'],
    ['04', 'Sustitucion de los CFDI previos'],
    ['05', 'Traslados de mercancias facturados previamente'],
    ['06', 'Factura generada por los traslados previos'],
    ['07', 'CFDI por aplicacion de anticipo'],
  ] as const

  for (const [code, desc] of relTypes) {
    await db.execute(sql`INSERT INTO sat_relationship_types (code, description) VALUES (${code}, ${desc}) ON CONFLICT (code) DO NOTHING`)
  }

  // ─── Claves de Producto/Servicio SAT (principales ~100) ───
  const productCodes = [
    ['01010101', 'No existe en el catalogo'],
    ['10101500', 'Animales vivos de granja'],
    ['25172500', 'Vehiculos de pasajeros'],
    ['41111500', 'Papel para imprimir y escribir'],
    ['43211500', 'Computadoras'],
    ['43211501', 'Computadoras de escritorio'],
    ['43211502', 'Computadoras portatiles'],
    ['43211503', 'Computadoras tableta'],
    ['43211600', 'Accesorios de computadoras'],
    ['43211700', 'Dispositivos de almacenamiento'],
    ['43222609', 'Cartuchos de toner'],
    ['43231500', 'Software funcional especifico de la empresa'],
    ['43231501', 'Software de planificacion de recursos empresariales ERP'],
    ['43231508', 'Software de contabilidad'],
    ['43231512', 'Software de facturacion'],
    ['43231513', 'Software de punto de venta POS'],
    ['43232100', 'Software de gestion de contenidos'],
    ['43232400', 'Software de comunicaciones'],
    ['44103100', 'Maquinas copiadoras'],
    ['44111500', 'Articulos de escritura'],
    ['44121600', 'Cintas adhesivas'],
    ['44122000', 'Accesorios de escritorio'],
    ['46181500', 'Equipos de vigilancia y deteccion'],
    ['47131700', 'Utensilios de limpieza'],
    ['50000000', 'Alimentos, bebidas y tabaco'],
    ['50101500', 'Frutas frescas'],
    ['50111500', 'Carne y aves de corral'],
    ['50112000', 'Pescados y mariscos'],
    ['50131600', 'Productos lacteos'],
    ['50161500', 'Chocolate y cacao'],
    ['50171500', 'Agua'],
    ['50171900', 'Bebidas no alcoholicas'],
    ['50192100', 'Cigarros y cigarrillos'],
    ['50202300', 'Pan y galletas y pastelillos'],
    ['50221100', 'Bebidas alcoholicas'],
    ['53131600', 'Ropa'],
    ['55101500', 'Publicaciones impresas'],
    ['60101700', 'Capacitacion en computacion o tecnologias de la informacion'],
    ['72101500', 'Servicios de apoyo a la construccion'],
    ['76111500', 'Limpieza de edificios'],
    ['78101800', 'Transporte de carga por carretera'],
    ['78101801', 'Servicio de transporte de carga terrestre'],
    ['78111500', 'Transporte de pasajeros por carretera'],
    ['80101500', 'Servicios de consultoria de negocios y administracion corporativa'],
    ['80111600', 'Servicios de personal temporal'],
    ['80131500', 'Servicios de alquiler y arrendamiento de propiedades o edificaciones'],
    ['80141600', 'Actividades de ventas y promocion de negocios'],
    ['81101500', 'Ingenieria civil y arquitectura'],
    ['81111500', 'Ingenieria de software o hardware'],
    ['81111800', 'Servicios de sistemas y administracion de componentes de sistemas'],
    ['81112000', 'Servicios de datos'],
    ['81112100', 'Servicios de internet'],
    ['81112200', 'Mantenimiento y soporte de software'],
    ['81141500', 'Servicios de contabilidad'],
    ['81141600', 'Servicios de auditoria'],
    ['81141700', 'Servicios de preparacion de impuestos'],
    ['81151600', 'Servicios legales'],
    ['82101500', 'Publicidad impresa'],
    ['82111700', 'Servicios de diseño grafico'],
    ['82111900', 'Servicios de fotografia'],
    ['82121500', 'Impresion'],
    ['83101500', 'Transmision de electricidad'],
    ['83101600', 'Servicios de agua'],
    ['83101800', 'Servicios de gas natural'],
    ['83111600', 'Servicios de comunicaciones telefonicas'],
    ['83111700', 'Servicios de acceso a internet'],
    ['84101600', 'Servicios de contabilidad financiera'],
    ['84111500', 'Servicios de banca'],
    ['84111506', 'Pago'],
    ['84121500', 'Servicios de seguros para estructuras y propiedades y posesiones'],
    ['84121600', 'Servicios de seguros de vida, salud y accidentes'],
    ['84131500', 'Arrendamiento de equipo'],
    ['85101500', 'Servicios de salud'],
    ['86101700', 'Instituciones educativas'],
    ['90101500', 'Restaurantes y catering (servicios de comidas y bebidas)'],
    ['90101800', 'Servicios de cafeteria'],
    ['90111500', 'Hoteles y moteles y pensiones'],
    ['91111500', 'Salones y centros de eventos'],
    ['93131600', 'Servicios de empleo'],
  ] as const

  for (const [code, desc] of productCodes) {
    await db.execute(sql`INSERT INTO sat_product_codes (code, description) VALUES (${code}, ${desc}) ON CONFLICT (code) DO NOTHING`)
  }

  // ─── Países SAT (principales para Carta Porte) ────────────
  const countries = [
    ['MEX', 'Mexico'], ['USA', 'Estados Unidos de America'], ['CAN', 'Canada'],
    ['GTM', 'Guatemala'], ['BLZ', 'Belice'], ['HND', 'Honduras'],
    ['SLV', 'El Salvador'], ['NIC', 'Nicaragua'], ['CRI', 'Costa Rica'],
    ['PAN', 'Panama'], ['COL', 'Colombia'], ['BRA', 'Brasil'],
    ['ARG', 'Argentina'], ['CHL', 'Chile'], ['PER', 'Peru'],
    ['ESP', 'Espana'], ['DEU', 'Alemania'], ['FRA', 'Francia'],
    ['GBR', 'Reino Unido'], ['CHN', 'China'], ['JPN', 'Japon'],
    ['KOR', 'Corea del Sur'], ['IND', 'India'],
  ] as const

  for (const [code, desc] of countries) {
    await db.execute(sql`INSERT INTO sat_countries (code, description) VALUES (${code}, ${desc}) ON CONFLICT (code) DO NOTHING`)
  }

  console.log('[mod-invoicing] SAT catalogs seeded OK')
}
