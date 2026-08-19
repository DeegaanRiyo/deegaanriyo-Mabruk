import { NextRequest, NextResponse } from 'next/server'
import { parseReceiptText } from '@/lib/receipt-parser'
import { extractText } from 'unpdf'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // H-01: Reject files over 5 MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large — 5 MB max' }, { status: 413 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)

    // Extract text from PDF — unpdf works server-side without workers
    const result = await extractText(data)
    const text = Array.isArray(result.text) ? result.text.join('\n') : String(result.text)

    if (!text || text.trim().length < 20) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 400 })
    }

    // Parse the receipt text
    const parsed = parseReceiptText(text)

    // Validate we got something useful
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
