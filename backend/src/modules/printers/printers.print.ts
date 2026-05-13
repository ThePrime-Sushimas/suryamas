import * as net from 'net'
import { PrinterConnectionError } from './printers.errors'

// ESC/POS command constants
const ESC = '\x1B'
const GS = '\x1D'
const COMMANDS = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_WIDTH: `${GS}!\x10`,
  DOUBLE_HEIGHT: `${GS}!\x01`,
  NORMAL_SIZE: `${GS}!\x00`,
  CUT: `${GS}V\x00`,
  PARTIAL_CUT: `${GS}V\x01`,
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`,
}

const LINE_WIDTH = { 80: 48, 58: 32 } as const
type PaperWidth = keyof typeof LINE_WIDTH

function getLineWidth(paperWidth: number): number {
  return LINE_WIDTH[paperWidth as PaperWidth] ?? 48
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

function separator(lineWidth: number, char = '-'): string {
  return char.repeat(lineWidth)
}

function doubleSeparator(lineWidth: number): string {
  return '='.repeat(lineWidth)
}

function twoColumn(left: string, right: string, lineWidth: number): string {
  const rightLen = right.length
  const leftLen = lineWidth - rightLen - 1
  return padRight(left, leftLen) + ' ' + right
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n)
}

export interface PrintPRData {
  request_number: string
  request_date: string
  branch_name: string
  needed_by_date: string | null
  status: string
  supplier_name: string | null
  paper_width: number
  lines: Array<{
    product_name: string
    qty: number
    uom: string
    estimated_price: number | null
  }>
}

export function buildPRReceipt(data: PrintPRData): string {
  const lw = getLineWidth(data.paper_width)
  const lines: string[] = []

  lines.push(COMMANDS.INIT)
  lines.push(COMMANDS.ALIGN_CENTER)
  lines.push(COMMANDS.BOLD_ON)
  lines.push(COMMANDS.DOUBLE_WIDTH)
  lines.push('SURYAMAS')
  lines.push(COMMANDS.NORMAL_SIZE)
  lines.push(COMMANDS.BOLD_OFF)
  lines.push('Purchase Request')
  lines.push(doubleSeparator(lw))

  lines.push(COMMANDS.ALIGN_LEFT)
  lines.push(twoColumn('No', `: ${data.request_number}`, lw))
  lines.push(twoColumn('Tgl', `: ${data.request_date}`, lw))
  lines.push(twoColumn('Branch', `: ${data.branch_name}`, lw))
  if (data.needed_by_date) {
    lines.push(twoColumn('Dibutuhkan', `: ${data.needed_by_date}`, lw))
  }
  if (data.supplier_name) {
    lines.push(twoColumn('Supplier', `: ${data.supplier_name}`, lw))
  }
  lines.push(twoColumn('Status', `: ${data.status}`, lw))

  lines.push(separator(lw))
  lines.push(COMMANDS.BOLD_ON)
  lines.push('ITEMS:')
  lines.push(COMMANDS.BOLD_OFF)

  let totalEstimated = 0
  data.lines.forEach((item, idx) => {
    const price = item.estimated_price ?? 0
    const subtotal = price * item.qty
    totalEstimated += subtotal

    lines.push(`${idx + 1}. ${item.product_name}`)
    const detail = `   ${item.qty} ${item.uom} @ Rp ${formatNumber(price)}`
    const sub = `Rp ${formatNumber(subtotal)}`
    lines.push(twoColumn(detail, sub, lw))
  })

  lines.push(separator(lw))
  lines.push(COMMANDS.BOLD_ON)
  lines.push(twoColumn('Total Estimasi', `Rp ${formatNumber(totalEstimated)}`, lw))
  lines.push(COMMANDS.BOLD_OFF)
  lines.push(doubleSeparator(lw))

  lines.push(COMMANDS.ALIGN_CENTER)
  const now = new Date()
  lines.push(`Printed: ${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`)
  lines.push('')
  lines.push(COMMANDS.FEED_LINES(4))
  lines.push(COMMANDS.PARTIAL_CUT)

  return lines.join('\n')
}

export async function sendToPrinter(ip: string, port: number, data: string, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    const buf = Buffer.from(data, 'binary')
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new PrinterConnectionError(ip, port, 'Connection timeout'))
    }, timeoutMs)

    socket.connect(port, ip, () => {
      socket.write(buf, (err) => {
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
