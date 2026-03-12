/**
 * Dynamic bridge to mod-invoicing module.
 * Avoids hard dependency — returns null when module is not available.
 */
export async function getInvoicingModule(app: any): Promise<any | null> {
  const modules: string[] = app.get('enabledModules') || []
  if (!modules.includes('mod-invoicing')) return null

  try {
    return await import('@enlocal/mod-invoicing')
  } catch {
    return null
  }
}
