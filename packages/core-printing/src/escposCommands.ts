// TODO: Comandos ESC/POS base
// - init, cut, feed, bold, align, fontSize, text, barcode

export const escposCommands = {
  INIT: '\x1B\x40',
  CUT: '\x1D\x56\x00',
  FEED: '\x0A',
  BOLD_ON: '\x1B\x45\x01',
  BOLD_OFF: '\x1B\x45\x00',
  ALIGN_LEFT: '\x1B\x61\x00',
  ALIGN_CENTER: '\x1B\x61\x01',
  ALIGN_RIGHT: '\x1B\x61\x02',
}
