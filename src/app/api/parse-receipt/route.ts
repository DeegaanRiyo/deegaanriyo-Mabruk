import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { detectCategory } from '@/lib/category-detector'
import { inferPiecesPerUnit } from '@/lib/receipt-parser'
import type { ParsedReceipt, ParsedReceiptItem } from '@/lib/receipt-parser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large — 5 MB max' }, { status: 413 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Detect file type — PDF uses document block, images use image block
    const mime = file.type || 'application/pdf'
    const isImage = mime.startsWith('image/')
    const supportedImages = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

    if (!isImage && mime !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload a PDF, JPEG, PNG, GIF, or WebP.' },
        { status: 400 },
      )
    }

    if (isImage && !supportedImages.includes(mime)) {
      return NextResponse.json(
        { error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' },
        { status: 400 },
      )
    }

    const fileBlock: Anthropic.Messages.ContentBlockParam = isImage
      ? {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        }
      : {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64,
          },
        }

    const anthropic = new Anthropic({ apiKey })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            fileBlock,
            {
              type: 'text',
              text: `You are parsing a Kenyan supplier POS receipt (e.g. Tawakall, Eastmatt, Gilani's). Extract ALL data and return ONLY valid JSON with this exact structure. Use null for fields you cannot find. Do NOT guess or hallucinate values.

{
  "supplier": {
    "name": "string - supplier/company name (usually all-caps at top)",
    "address": "string or empty",
    "phone": "string or empty - telephone numbers",
    "kra_pin": "string or empty - KRA PIN (starts with P followed by digits)",
    "agent_no": "string or empty",
    "store_no": "string or empty"
  },
  "receipt": {
    "number": "string - receipt number e.g. ABEY/0007147",
    "type": "string - one of: cash_sale, credit_note, legal_receipt",
    "date": "string - ISO date YYYY-MM-DD",
    "customer": "string or empty",
    "served_by": "string or empty - from YOU WERE SERVED BY"
  },
  "items": [
    {
      "code": "string - supplier product code (numeric)",
      "name": "string - product name WITHOUT the pack size portion",
      "pack_size": "string - size info like 48x390G, 24x400ML, 10KG, or empty if none",
      "unit_type": "string - one of: PC, PKT, CTN, BAL, DOZ, BAG. Look for (CTN), (PKT) etc in parentheses after product name. Default PC if not shown",
      "qty": "number - quantity purchased",
      "rate": "number - price per unit (amount divided by qty)",
      "amount": "number - line total",
      "vat_class": "string - A or B (shown at end of each item line)",
      "voided": "boolean - true if item has [VO] or void marker"
    }
  ],
  "footer": {
    "total": "number - receipt total amount",
    "tendered": "number - amount tendered/paid, or 0 if not shown",
    "change": "number - change given, or 0 if not shown",
    "item_quantity": "number - total item count if shown, or 0",
    "vat_a_amount": "number - VAT A (16%) amount, or 0",
    "vat_b_amount": "number - VAT B (0%) amount, or 0"
  }
}

Important rules:
- Extract EVERY line item, do not skip any
- The product name should NOT include pack size info (e.g. "KIMBO" not "KIMBO 24x500G")
- Pack size is the dimension portion like "48x390G", "24x400ML", "10KG", "5xAA"
- Rate = amount / qty (calculate if not explicitly shown)
- If receipt appears twice (duplicate copy), only parse the first occurrence
- Return ONLY the JSON object, no markdown fences, no explanation`,
            },
          ],
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'No text response from AI' },
        { status: 500 },
      )
    }

    let rawJson = textBlock.text.trim()
    if (rawJson.startsWith('```')) {
      rawJson = rawJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const aiResult = JSON.parse(rawJson)

    // Post-process: add pieces_per_unit and category (cheaper to do locally)
    const items: ParsedReceiptItem[] = (aiResult.items || []).map(
      (item: Record<string, unknown>) => ({
        code: String(item.code || ''),
        name: String(item.name || ''),
        pack_size: String(item.pack_size || ''),
        unit_type: String(item.unit_type || 'PC'),
        pieces_per_unit: inferPiecesPerUnit(
          String(item.pack_size || ''),
          String(item.unit_type || 'PC'),
        ),
        qty: Number(item.qty) || 0,
        rate: Number(item.rate) || 0,
        amount: Number(item.amount) || 0,
        vat_class: String(item.vat_class || 'A'),
        voided: Boolean(item.voided),
        category: detectCategory(String(item.name || '')),
      }),
    )

    const parsed: ParsedReceipt = {
      supplier: {
        name: String(aiResult.supplier?.name || ''),
        address: String(aiResult.supplier?.address || ''),
        phone: String(aiResult.supplier?.phone || ''),
        kra_pin: String(aiResult.supplier?.kra_pin || ''),
        agent_no: String(aiResult.supplier?.agent_no || ''),
        store_no: String(aiResult.supplier?.store_no || ''),
      },
      receipt: {
        number: String(aiResult.receipt?.number || ''),
        type: String(aiResult.receipt?.type || ''),
        date: String(aiResult.receipt?.date || ''),
        customer: String(aiResult.receipt?.customer || ''),
        served_by: String(aiResult.receipt?.served_by || ''),
      },
      items,
      footer: {
        total: Number(aiResult.footer?.total) || 0,
        tendered: Number(aiResult.footer?.tendered) || 0,
        change: Number(aiResult.footer?.change) || 0,
        item_quantity: Number(aiResult.footer?.item_quantity) || 0,
        vat_a_amount: Number(aiResult.footer?.vat_a_amount) || 0,
        vat_b_amount: Number(aiResult.footer?.vat_b_amount) || 0,
      },
    }

    if (parsed.items.length === 0) {
      return NextResponse.json(
        { error: 'No items found in receipt. Make sure the PDF is a valid supplier receipt.' },
        { status: 400 },
      )
    }

    return NextResponse.json(parsed)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to parse receipt: ${message}` }, { status: 500 })
  }
}
