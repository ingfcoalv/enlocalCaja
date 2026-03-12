import { randomUUID } from 'crypto'

export interface PACStampResult {
  uuid: string
  stampedXml: string
  stampDate: string
}

export interface PACCancelResult {
  success: boolean
  acuse: string
  cancelDate: string
}

export interface PACStatusResult {
  uuid: string
  status: string
  cancellable: boolean
}

export interface PACProvider {
  stamp(xml: string): Promise<PACStampResult>
  cancel(uuid: string): Promise<PACCancelResult>
  getStatus(uuid: string): Promise<PACStatusResult>
}

export class MockPACProvider implements PACProvider {
  async stamp(xml: string): Promise<PACStampResult> {
    const uuid = randomUUID()
    const stampDate = new Date().toISOString()

    // Inject a mock TimbreFiscalDigital complement into the XML
    const timbreComplement = `  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital
      xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
      Version="1.1"
      UUID="${uuid}"
      FechaTimbrado="${stampDate}"
      RfcProvCertif="SPR190613I52"
      SelloCFD="MOCK_SELLO_CFD"
      NoCertificadoSAT="00001000000000000001"
      SelloSAT="MOCK_SELLO_SAT"/>
  </cfdi:Complemento>`

    // Insert the complement before the closing Comprobante tag
    const stampedXml = xml.replace(
      '</cfdi:Comprobante>',
      `${timbreComplement}\n</cfdi:Comprobante>`
    )

    return {
      uuid,
      stampedXml,
      stampDate,
    }
  }

  async cancel(uuid: string): Promise<PACCancelResult> {
    return {
      success: true,
      acuse: `<?xml version="1.0" encoding="UTF-8"?>
<Acuse>
  <Folios>
    <UUID>${uuid}</UUID>
    <EstatusUUID>201</EstatusUUID>
  </Folios>
  <Fecha>${new Date().toISOString()}</Fecha>
  <RfcEmisor>MOCK000000AAA</RfcEmisor>
</Acuse>`,
      cancelDate: new Date().toISOString(),
    }
  }

  async getStatus(uuid: string): Promise<PACStatusResult> {
    return {
      uuid,
      status: 'Vigente',
      cancellable: true,
    }
  }
}

export function createPACProvider(): PACProvider {
  // Future: check env/config for real PAC credentials and return
  // a real provider (Finkok, Digicraft, SW, etc.)
  return new MockPACProvider()
}
