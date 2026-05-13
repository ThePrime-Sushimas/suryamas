import * as net from 'net'
import { PrinterConnectionError } from './printers.errors'

// ─── ESC/POS Commands ────────────────────────────────────────────────────────

const ESC = '\x1B'
const GS = '\x1D'
const LF = '\x0A'

const CMD = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_WIDTH: `${GS}!\x10`,
  NORMAL_SIZE: `${GS}!\x00`,
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`,
  PARTIAL_CUT: `${GS}V\x01`,
}

// ─── Buffer Builder ──────────────────────────────────────────────────────────

class ReceiptBuilder {
  private buffers: Buffer[] = []

  /** Push raw command bytes (no line feed) */
  cmd(s: string): this { this.buffers.push(Buffer.from(s, 'binary')); return this }

  /** Push text line with LF */
  line(s: string): this { this.buffers.push(Buffer.from(s + LF, 'binary')); return this }

  /** Push empty line */
  lf(): this { this.buffers.push(Buffer.from(LF, 'binary')); return this }

  build(): Buffer { return Buffer.concat(this.buffers) }
}

// ─── Layout Helpers ──────────────────────────────────────────────────────────

const LINE_WIDTH = { 80: 48, 58: 32 } as const

function lw(paperWidth: number): number {
  return LINE_WIDTH[paperWidth as keyof typeof LINE_WIDTH] ?? 48
}

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

function sep(w: number, char = '-'): string { return char.repeat(w) }
function dsep(w: number): string { return '='.repeat(w) }
function cols(left: string, right: string, w: number): string {
  const rightLen = Math.min(right.length, w - 1)
  const leftLen = Math.max(0, w - rightLen - 1)
  return pad(left, leftLen) + ' ' + right.slice(0, rightLen)
}

export function fmt(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n)
}

// ─── Generic Receipt Template System ─────────────────────────────────────────

export type ReceiptRow =
  | { type: 'title'; text: string }
  | { type: 'subtitle'; text: string }
  | { type: 'separator' }
  | { type: 'double-separator' }
  | { type: 'kv'; key: string; value: string }
  | { type: 'section-header'; text: string }
  | { type: 'item'; label: string; detail: string; amount: string }
  | { type: 'total'; label: string; amount: string }
  | { type: 'center'; text: string }
  | { type: 'text'; text: string }

export interface ReceiptTemplate {
  paper_width: number
  rows: ReceiptRow[]
}

/**
 * Build ESC/POS receipt Buffer from a generic template.
 */
export function buildReceipt(template: ReceiptTemplate): Buffer {
  const w = lw(template.paper_width)
  const b = new ReceiptBuilder()

  b.cmd(CMD.INIT)

  for (const row of template.rows) {
    switch (row.type) {
      case 'title':
        b.cmd(CMD.ALIGN_CENTER).cmd(CMD.BOLD_ON).cmd(CMD.DOUBLE_WIDTH)
        b.line(row.text)
        b.cmd(CMD.NORMAL_SIZE).cmd(CMD.BOLD_OFF)
        break
      case 'subtitle':
        b.cmd(CMD.ALIGN_CENTER).line(row.text)
        break
      case 'separator':
        b.cmd(CMD.ALIGN_LEFT).line(sep(w))
        break
      case 'double-separator':
        b.cmd(CMD.ALIGN_LEFT).line(dsep(w))
        break
      case 'kv':
        b.cmd(CMD.ALIGN_LEFT).line(cols(row.key, `: ${row.value}`, w))
        break
      case 'section-header':
        b.cmd(CMD.ALIGN_LEFT).cmd(CMD.BOLD_ON).line(row.text).cmd(CMD.BOLD_OFF)
        break
      case 'item':
        b.cmd(CMD.ALIGN_LEFT).line(row.label).line(cols(`   ${row.detail}`, row.amount, w))
        break
      case 'total':
        b.cmd(CMD.ALIGN_LEFT).cmd(CMD.BOLD_ON).line(cols(row.label, row.amount, w)).cmd(CMD.BOLD_OFF)
        break
      case 'center':
        b.cmd(CMD.ALIGN_CENTER).line(row.text)
        break
      case 'text':
        b.cmd(CMD.ALIGN_LEFT).line(row.text)
        break
    }
  }

  b.lf().cmd(CMD.FEED_LINES(4)).cmd(CMD.PARTIAL_CUT)
  return b.build()
}

// ─── Pre-built Document Template ─────────────────────────────────────────────

export interface PrintDocData {
  paper_width: number
  doc_title: string
  header: Array<{ key: string; value: string }>
  items: Array<{ label: string; detail: string; amount: string }>
  total_label: string
  total_amount: string
  footer?: string
}

/**
 * Generic document receipt — works for PR, PO, Goods Receipt, etc.
 */
export function buildDocReceipt(data: PrintDocData): Buffer {
  const rows: ReceiptRow[] = [
    { type: 'title', text: 'SURYAMAS' },
    { type: 'subtitle', text: data.doc_title },
    { type: 'double-separator' },
    ...data.header.map(h => ({ type: 'kv' as const, key: h.key, value: h.value })),
    { type: 'separator' },
    { type: 'section-header', text: 'ITEMS:' },
    ...data.items.map(i => ({ type: 'item' as const, label: i.label, detail: i.detail, amount: i.amount })),
    { type: 'separator' },
    { type: 'total', label: data.total_label, amount: data.total_amount },
    { type: 'double-separator' },
  ]

  if (data.footer) {
    rows.push({ type: 'center', text: data.footer })
  }

  const now = new Date()
  rows.push({ type: 'center', text: `Printed: ${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` })

  return buildReceipt({ paper_width: data.paper_width, rows })
}

// ─── Network ─────────────────────────────────────────────────────────────────

export async function sendToPrinter(ip: string, port: number, data: Buffer, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new PrinterConnectionError(ip, port, 'Connection timeout'))
    }, timeoutMs)

    socket.connect(port, ip, () => {
      socket.write(data, (err) => {
        clearTimeout(timer)
        socket.end()
        if (err) reject(new PrinterConnectionError(ip, port, err.message))
        else resolve()
      })
    })

    socket.on('error', (err) => {
      clearTimeout(timer)
      socket.destroy()
      reject(new PrinterConnectionError(ip, port, err.message))
    })
  })
}

export async function testPrinterConnection(ip: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    const timer = setTimeout(() => { socket.destroy(); resolve(false) }, 3000)

    socket.connect(port, ip, () => {
      clearTimeout(timer)
      socket.end()
      resolve(true)
    })

    socket.on('error', () => { clearTimeout(timer); socket.destroy(); resolve(false) })
  })
}
