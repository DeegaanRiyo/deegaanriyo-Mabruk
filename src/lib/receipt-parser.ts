/**
 * Receipt Text Parser
 * Parses structured text extracted from Kenyan supplier POS receipts
 * (Tawakall-style: consistent two-line-per-item format)
 */

import { detectCategory } from './category-detector'

// ── Types ───────────────────────────────────────────────────

export interface ParsedSupplier {
  name: string
  address: string
  phone: string
  kra_pin: string
  agent_no: string
  store_no: string
}

export interface ParsedReceiptHeader {
  number: string        // e.g. "ABEY/0007147"
  type: string          // "cash_sale" | "credit_note"
  date: string          // ISO date string
  customer: string
  served_by: string
}

export interface ParsedReceiptItem {
  code: string          // supplier product code
  name: string          // product name as on receipt
  pack_size: string     // e.g. "48x390G", "24x400ML"
  unit_type: string     // PC, PKT, CTN, BAL, DOZ, BAG, OUT
  pieces_per_unit: number
  qty: number           // quantity purchased (can be fractional)
  rate: number          // price per unit
  amount: number        // line total (qty × rate)
  vat_class: string     // A or B
  voided: boolean
  category: string | null
}

export interface ParsedReceiptFooter {
  total: number
  tendered: number
  change: number
  item_quantity: number
  vat_a_amount: number
  vat_b_amount: number
}

export interface ParsedReceipt {
  supplier: ParsedSupplier
  receipt: ParsedReceiptHeader
  items: ParsedReceiptItem[]
  footer: ParsedReceiptFooter
}

// ── Helpers ─────────────────────────────────────────────────

function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0
}

function parseDate(dateStr: string): string {
  // "06-Aug-2026" → ISO
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  }
  const m = dateStr.match(/(\d{1,2})-(\w{3})-(\d{4})/)
  if (!m) return dateStr
  const month = months[m[2]] || '01'
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`
}

/** Infer pieces_per_unit from a pack size string */
export function inferPiecesPerUnit(packSize: string, unitType: string): number {
  if (unitType === 'PC') return 1

  const s = packSize.toUpperCase().replace(/\s/g, '')
  if (!s) return 1

  // "6x24PC", "4x60PC" → multiply both numbers
  const countXcount = s.match(/^(\d+)X(\d+)PC$/i)
  if (countXcount) return parseInt(countXcount[1]) * parseInt(countXcount[2])

  // "10x15x20G" → first two numbers multiplied (packs × sachets)
  const triple = s.match(/^(\d+)X(\d+)X\d+\w*$/i)
  if (triple) return parseInt(triple[1]) * parseInt(triple[2])

  // "48x390G", "24x400ML", "20x500G" → first number is count
  const countXweight = s.match(/^(\d+)X[\d.]+(?:G|GMS|ML|KG|LTR|L)\b/i)
  if (countXweight) return parseInt(countXweight[1])

  // "10KG", "5LTR" — single weight/volume unit
  const singleWeight = s.match(/^\d+(?:G|GMS|ML|KG|LTR|L)$/i)
  if (singleWeight) return 1

  // "5xAA", "6xAAA" — count × non-numeric
  const countXother = s.match(/^(\d+)X/i)
  if (countXother) return parseInt(countXother[1])

  // Fallback: first number
  const firstNum = s.match(/^(\d+)/)
  return firstNum ? parseInt(firstNum[1]) : 1
}

// ── Main Parser ─────────────────────────────────────────────

export function parseReceiptText(text: string): ParsedReceipt {
  // Take only first receipt copy (receipt appears twice in some PDFs)
  const startMarker = 'RECEIPT COPY START'
  const endMarker = 'RECEIPT COPY END'
  const startIdx = text.indexOf(startMarker)
  const endIdx = text.indexOf(endMarker, startIdx + 1)
  const receiptText = startIdx >= 0 && endIdx >= 0
    ? text.substring(startIdx, endIdx)
    : text

  const lines = receiptText.split('\n').map(l => l.trim()).filter(Boolean)

  // ── Parse Header ────────────────────────────────────────
  const supplier: ParsedSupplier = {
    name: '', address: '', phone: '', kra_pin: '', agent_no: '', store_no: '',
  }
  const receipt: ParsedReceiptHeader = {
    number: '', type: '', date: '', customer: '', served_by: '',
  }

  // Supplier name: first substantial line after marker
  let headerEnd = 0
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i]

    // Skip marker line
    if (line.includes('RECEIPT COPY START') || line.includes('---')) continue

    // Supplier name: first all-caps line (not a code, not a marker)
    if (!supplier.name && /^[A-Z][A-Z\s&.]+(?:LTD|LIMITED|CO|CORP)?\.?$/.test(line)) {
      supplier.name = line
      continue
    }

    // Address: line after supplier name, contains STREET/ROAD or is short text
    if (supplier.name && !supplier.address && !line.startsWith('P.O.') && !line.startsWith('P0') &&
        !line.match(/^AGENT/) && !line.match(/^Tel/) && !line.match(/^\*/) &&
        !line.match(/^Cash|^Credit|^Legal|^Date/) && !line.match(/^[A-Z]\d{8,}/)) {
      supplier.address = line
      continue
    }

    // KRA PIN: starts with P followed by digits
    if (line.match(/^P\d{9,}/)) {
      supplier.kra_pin = line
      continue
    }

    // Agent/Store numbers
    const agentMatch = line.match(/AGENT\s*NO[:\s]*(\S+)/i)
    if (agentMatch) {
      supplier.agent_no = agentMatch[1].replace(/\/.*/, '')
      const storeMatch = line.match(/STOR\s*NO\s*(\S+)/i)
      if (storeMatch) supplier.store_no = storeMatch[1]
      continue
    }

    // Phone
    if (line.match(/^Tel/i)) {
      supplier.phone = line.replace(/^Tel\s*/i, '').replace(/[.\s]/g, ',').replace(/,+/g, ', ')
      continue
    }

    // Receipt type + number
    const receiptMatch = line.match(/(Cash Sale|Credit Note|Legal Receipt)\s*(?:COPY\s*)?#\s*(.+)/i)
    if (receiptMatch) {
      const typeMap: Record<string, string> = {
        'cash sale': 'cash_sale', 'credit note': 'credit_note', 'legal receipt': 'legal_receipt',
      }
      receipt.type = typeMap[receiptMatch[1].toLowerCase()] || receiptMatch[1].toLowerCase()
      receipt.number = receiptMatch[2].trim()
      continue
    }

    // Date/Time
    const dateMatch = line.match(/^Date:\s*(.+?)\s+Time:\s*(.+)/i)
    if (dateMatch) {
      receipt.date = parseDate(dateMatch[1])
      continue
    }

    // Customer
    const custMatch = line.match(/^Customer:\s*(.+)/i)
    if (custMatch) {
      receipt.customer = custMatch[1].trim()
      headerEnd = i + 1
      break
    }

    // If we hit the ITEM header row, stop
    if (line.match(/^ITEM\s+QTY\s+AMOUNT/i)) {
      headerEnd = i
      break
    }
  }

  // ── Parse Items ─────────────────────────────────────────
  const items: ParsedReceiptItem[] = []

  // Find the item section (between --- lines after ITEM QTY AMOUNT)
  let itemStart = headerEnd
  for (let i = headerEnd; i < lines.length; i++) {
    if (lines[i].match(/^-{5,}/) && i > headerEnd) {
      itemStart = i + 1
      break
    }
    if (lines[i].match(/^ITEM\s+QTY/i)) {
      // Next --- line starts items
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^-{5,}/)) {
          itemStart = j + 1
          break
        }
      }
      break
    }
  }

  // Parse two-line item pairs
  let i = itemStart
  while (i < lines.length - 1) {
    const line1 = lines[i]
    const line2 = lines[i + 1]

    // Stop at footer separator
    if (line1.match(/^-{5,}/) || line1.match(/^TOTAL\s/i)) break

    // Line 1: code + qty
    // Pattern: <code> <qty> x
    const codeLine = line1.match(/^(\d+)\s+([\d.]+)\s*x\s*$/i)
    if (!codeLine) {
      // Skip non-matching lines (separators, etc.)
      i++
      continue
    }

    const code = codeLine[1]
    const qty = parseFloat(codeLine[2])

    // Line 2: product name + amount + VAT class + optional void marker
    // Pattern: <PRODUCT INFO> <amount> <A|B> [optional [VO marker]
    const productLine = line2.match(/^(.+?)\s+([\d,]+\.\d{2})\s+([AB])\s*(\[VO.*)?$/i)
    if (!productLine) {
      i += 2
      continue
    }

    const rawProductInfo = productLine[1].trim()
    const amount = parseNum(productLine[2])
    const vatClass = productLine[3].toUpperCase()
    const voided = !!productLine[4]

    // Extract unit type from parentheses at end of product info
    let unitType = 'PC'  // default
    let productInfo = rawProductInfo
    const unitMatch = rawProductInfo.match(/\((\w+)\)\s*$/)
    if (unitMatch) {
      const extractedUnit = unitMatch[1].toUpperCase()
      const validUnits = ['PC', 'PKT', 'CTN', 'BAL', 'DOZ', 'BAG', 'OUT']
      if (validUnits.includes(extractedUnit)) {
        unitType = extractedUnit
      }
      productInfo = rawProductInfo.replace(/\s*\(\w+\)\s*$/, '').trim()
    }

    // Extract pack size from product info (patterns like 48x390G, 24x400ML, 10KG)
    let packSize = ''
    let productName = productInfo

    // Match dimension patterns: NxNNNunit, NxNxNunit, NxNPC, NKG, etc.
    const sizeMatch = productInfo.match(/\s+(\d+[xX]\d+(?:[xX]\d+)?(?:G|GMS|ML|KG|LTR|L|PC|AA+)?)\s*$/i)
      || productInfo.match(/\s+(\d+(?:G|GMS|ML|KG|LTR|L))\s*$/i)
    if (sizeMatch) {
      packSize = sizeMatch[1]
      productName = productInfo.replace(sizeMatch[0], '').trim()
    } else {
      // Try embedded size (no space before digits, like "CLEANER24x500ML")
      const embeddedMatch = productInfo.match(/([A-Z])(\d+[xX]\d+(?:[xX]\d+)?(?:G|GMS|ML|KG|LTR|L)?)\s*$/i)
      if (embeddedMatch) {
        packSize = embeddedMatch[2]
        productName = productInfo.replace(embeddedMatch[2], '').trim()
      }
    }

    // Also try matching "5xAA" style for non-standard products
    if (!packSize) {
      const otherMatch = productInfo.match(/\s+(\d+[xX]\w+)\s*$/i)
      if (otherMatch) {
        packSize = otherMatch[1]
        productName = productInfo.replace(otherMatch[0], '').trim()
      }
    }

    const rate = qty > 0 ? amount / qty : 0
    const ppu = inferPiecesPerUnit(packSize, unitType)

    items.push({
      code,
      name: productName,
      pack_size: packSize,
      unit_type: unitType === 'OUT' ? 'PC' : unitType, // OUT → PC
      pieces_per_unit: ppu,
      qty,
      rate: Math.round(rate * 100) / 100,
      amount,
      vat_class: vatClass,
      voided,
      category: detectCategory(productName),
    })

    i += 2
  }

  // ── Parse Footer ────────────────────────────────────────
  const footer: ParsedReceiptFooter = {
    total: 0, tendered: 0, change: 0, item_quantity: 0,
    vat_a_amount: 0, vat_b_amount: 0,
  }

  for (let j = i; j < lines.length; j++) {
    const line = lines[j]
    const totalMatch = line.match(/^TOTAL\s+([\d,]+\.?\d*)/i)
    if (totalMatch) footer.total = parseNum(totalMatch[1])

    const tenderedMatch = line.match(/^Tendered\s+([\d,]+\.\d{2})/i)
    if (tenderedMatch) footer.tendered = parseNum(tenderedMatch[1])

    const changeMatch = line.match(/^CHANGE\s*:\s*([\d,]+\.\d{2})/i)
    if (changeMatch) footer.change = parseNum(changeMatch[1])

    const itemQtyMatch = line.match(/^Item Quantity:\s*([\d.]+)/i)
    if (itemQtyMatch) footer.item_quantity = parseFloat(itemQtyMatch[1])

    // VAT lines: "A 16.00 55,220.00 VAT AMT 7,616"
    const vatAMatch = line.match(/^A\s+16\.00\s+[\d,]+\.\d{2}\s+VAT AMT\s+([\d,]+)/i)
    if (vatAMatch) footer.vat_a_amount = parseNum(vatAMatch[1])

    const vatBMatch = line.match(/^B\s+0\.00\s+[\d,]+\.\d{2}\s+VAT AMT\s+([\d,]+)/i)
    if (vatBMatch) footer.vat_b_amount = parseNum(vatBMatch[1])

    // Served by
    const servedMatch = line.match(/^YOU WERE SERVED BY:\s*(.+)/i)
    if (servedMatch) receipt.served_by = servedMatch[1].trim()
  }

  return { supplier, receipt, items, footer }
}
