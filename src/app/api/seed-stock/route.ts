import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Suppliers ───────────────────────────────────────────────────────────────
const SUPPLIERS = [
  {
    key: 'kulmis',
    name: 'KULMIS SPICES',
    address: '12th Street KBS Garage',
    phone: '0722 996 531',
  },
  {
    key: 'tawakall',
    name: 'TAWAKALL GENERAL STORES LTD',
    address: 'Jam Street, Eastleigh, P.O. Box 7549-00610',
    phone: '0728328080, 0728328050',
    kra_pin: 'P051500648Y',
    agent_no: '2916449',
    store_no: '2918678',
  },
  {
    key: 'gwholesalers',
    name: 'G-WHOLESALERS',
    address: null,
    phone: null,
  },
  {
    key: 'mire',
    name: 'MIRE SHOP BACADOW NO 3',
    address: null,
    phone: null,
  },
] as const

// ── Types ───────────────────────────────────────────────────────────────────
type UnitType = 'PC' | 'PKT' | 'CTN' | 'BAL' | 'DOZ' | 'BAG'

interface RawItem {
  code: string
  name: string        // clean product name (no size, no suffix)
  size: string        // e.g. "48x390G", "10KG", "5xAA"
  unitType: UnitType
  ppu: number         // pieces_per_unit
  qty: number         // units bought (from receipt)
  unitCost: number    // cost per unit (from receipt)
  vat: 'A' | 'B'
  voided?: boolean    // true = don't add stock (voided on paper receipt)
}

interface Receipt {
  number: string
  supplier: string    // key into SUPPLIERS
  type: 'cash_sale' | 'credit_note'
  date: string        // ISO date
  customer: string
  items: RawItem[]
}

// ── Category assignment ─────────────────────────────────────────────────────
function assignCategory(name: string): string {
  const n = name.toUpperCase()

  // Spices & Cooking Aids
  if (/CARDAMOM|GINGER|CINNAMON|PEPPER|CLOVES|CUMIN|DHANIA|MASALA|PILAU|TUMERIC|CUSTARD|FOOD COLOU?R|BAKING|YEAST|ROYCO|VANILLA/.test(n)) return 'Cooking Aids'

  // Staples
  if (/BEAN|SORGHUM|WHEAT|MAIZE|SPGT|SPAGHETTI|PASTA|RICE|UGALI|NGANO|OATS|AJAB|MUTLU|GOLDA|YUMIS|TIMIR|ATTA|CRACKED/.test(n)) return 'Staples & Flour'

  // Dairy
  if (/MILK|BLUE BAND|BROOKSIDE|DAIMA|LATO|CONDENSED|CNDND/.test(n)) return 'Dairy & Spreads'

  // Cooking Oils
  if (/OIL(?!ET)|POPCO|PIKA|RINSUN|OLIVITA|VINEG/.test(n) && !/BABY OIL|VATIKA/.test(n)) return 'Cooking Oils'
  if (/KENTASTE COCONUT/.test(n)) return 'Cooking Oils'

  // Canned & Sauces
  if (/TUNA|COCONUT CREAM|CCNT CREAM|KETCHUP|KERCHUP|CHILI(?! SAUCE)|TMT|TOMATO|GILDA|FARAGELLO|NASH|DANA/.test(n)) return 'Canned & Sauces'
  if (/COCONUT MILK|CCNT MILK/.test(n)) return 'Canned & Sauces'

  // Snacks
  if (/BISCUIT|BSCT|OREO|TWIST|GUM|CHOCO|BUBBLY|NUTEI|FOSTER|LINDO|RAHA|LOLLIPOP|BIGG DADY|MABUYUZ|BATOOK|JUICY|SNICHERS/.test(n)) return 'Snacks & Confectionery'

  // Hot Beverages
  if (/TEA|NESCAFE|COFFEE|FAHARI|KERICHO|KEN FRESH/.test(n)) return 'Hot Beverages'

  // Cold Beverages
  if (/WATER|JUICE|SODA|ENERGY|PREDATOR|MM |MINUTE|BRAVA|GLACIER|INDOMIE/.test(n) && !/HAND WASH/.test(n)) return 'Cold Beverages'

  // Cleaning
  if (/STEEL WOOL|VIM|BIO BRIGHT|WHITE WASH|JAMAA|DISHWASH|GLASS CLEAN|DOWNY|STA SOFT|USHINDI|CHARCOAL|MOSQUITO|SHENKE/.test(n)) return 'Cleaning & Household'

  // Toiletries
  if (/SHAMP|SOAP|LOTION|TOOTHBR|COLGATE|COLG|VASELI|DOVE(?! SH)|DETTOL|PANTENE|HEAD.?SHOULDER|BABY|ARIMIS|VATIKA|HAND WASH|TREAT|CREAM|AMARA|BOUTIQUE|SUMMER|ARGAN|CRYSTAL/.test(n)) return 'Toiletries & Personal Care'

  // Paper Products
  if (/SOFTCARE|SOFTDREAM|SPACE JUMBO|MOMEASY|BELLA|WIPE/.test(n)) return 'Paper Products'

  // Fragrance
  if (/AIRFRESH|NASEEM|DIRHAM/.test(n)) return 'Fragrance & Air Care'

  // Porridge & Baking
  if (/WEETABIX|NAJAH|UJI|SALAMA OATS/.test(n)) return 'Porridge & Baking'

  // Batteries
  if (/EVEREADY|BATTER/.test(n)) return 'Batteries & Electronics'

  // Jams & Spreads
  if (/JAM|NUTELLA|C ?B ?C/.test(n)) return 'Dairy & Spreads'

  // Sugar
  if (/SUGAR/.test(n)) return 'Staples & Flour'

  // Diapers / personal
  if (/KIDS|GILLETTE/.test(n)) return 'Toiletries & Personal Care'

  // Default
  return 'Cleaning & Household'
}

// ── Receipt data ────────────────────────────────────────────────────────────
// Format: { code, name, size, unitType, ppu, qty, unitCost, vat }
// ppu = pieces_per_unit (first number in size before 'x', or 1 if no 'x')

const RECEIPTS: Receipt[] = [
  // ── 1. Kulmis Spices #0676552 ──
  {
    number: '0676552', supplier: 'kulmis', type: 'cash_sale',
    date: '2026-08-18', customer: 'abdirashid',
    items: [
      { code: '000001022', name: 'YELLOW BEANS', size: 'KG', unitType: 'BAG', ppu: 1, qty: 5, unitCost: 130, vat: 'A' },
      { code: '000000021', name: 'CARDAMOM WHOLE', size: 'KG', unitType: 'BAG', ppu: 1, qty: 5, unitCost: 1950, vat: 'A' },
      { code: '000003062', name: 'GREEN CARDAMOM', size: 'KG', unitType: 'BAG', ppu: 1, qty: 3, unitCost: 3400, vat: 'A' },
      { code: '000000023', name: 'GINGER ETHIO', size: 'KG', unitType: 'BAG', ppu: 1, qty: 5, unitCost: 500, vat: 'A' },
      { code: '000003082', name: 'GINGER TZ', size: 'KG', unitType: 'BAG', ppu: 1, qty: 3, unitCost: 650, vat: 'A' },
      { code: '000000019', name: 'CINNAMON STICK', size: 'KG', unitType: 'BAG', ppu: 1, qty: 5, unitCost: 400, vat: 'A' },
      { code: '000000027', name: 'BLACK PEPPER WHOLE', size: 'KG', unitType: 'BAG', ppu: 1, qty: 5, unitCost: 1050, vat: 'A' },
      { code: '000000014', name: 'CLOVES WHOLE', size: 'KG', unitType: 'BAG', ppu: 1, qty: 5, unitCost: 900, vat: 'A' },
      { code: '000001029', name: 'SORGHUM', size: 'KG', unitType: 'BAG', ppu: 1, qty: 3, unitCost: 180, vat: 'A' },
      { code: '000003051', name: 'WHEAT', size: 'KG', unitType: 'BAG', ppu: 1, qty: 5, unitCost: 100, vat: 'A' },
      { code: '000004086', name: 'DIGIR SOMALI', size: 'KG', unitType: 'BAG', ppu: 1, qty: 5, unitCost: 100, vat: 'A' },
      { code: '000000028', name: 'WHITE MAIZE', size: 'KG', unitType: 'BAG', ppu: 1, qty: 5, unitCost: 100, vat: 'A' },
      { code: '000003049', name: 'CUMIN SEEDS G1', size: 'KG', unitType: 'BAG', ppu: 1, qty: 5, unitCost: 650, vat: 'A' },
      { code: '000007132', name: 'DHANIA WHOLE', size: 'KG', unitType: 'BAG', ppu: 1, qty: 5, unitCost: 350, vat: 'A' },
    ],
  },

  // ── 2. Tawakall #0008578 ──
  {
    number: '0008578', supplier: 'tawakall', type: 'cash_sale',
    date: '2026-08-14', customer: 'sultan shop',
    items: [
      { code: '000004395', name: 'STEEL WOOL', size: '20x30x15G', unitType: 'PC', ppu: 20, qty: 2, unitCost: 150, vat: 'A' },
      { code: '1000731', name: 'BAKING POWDER', size: '72x100G', unitType: 'DOZ', ppu: 72, qty: 1, unitCost: 360, vat: 'A' },
      { code: '000014124', name: 'MAGEST YEAST', size: '60x90G', unitType: 'PC', ppu: 1, qty: 12, unitCost: 80, vat: 'A' },
    ],
  },

  // ── 3. G-Wholesalers #0038506 ──
  {
    number: '0038506', supplier: 'gwholesalers', type: 'cash_sale',
    date: '2026-08-17', customer: 'MUBARAK SHOP',
    items: [
      { code: '000001331', name: 'KIDS 2+AGE', size: 'DRS', unitType: 'PC', ppu: 1, qty: 1, unitCost: 350, vat: 'A' },
      { code: '000002134', name: 'GILLETTE 2', size: 'DRS', unitType: 'PC', ppu: 1, qty: 1, unitCost: 450, vat: 'A' },
      { code: '10000388', name: 'GLACIER WATER 5LTR', size: '5LTR', unitType: 'PC', ppu: 1, qty: 4, unitCost: 360, vat: 'A' },
    ],
  },

  // ── 4. Tawakall Credit Note #0000606 ──
  // These reverse the voided items in receipt 6 — net zero stock
  {
    number: '0000606', supplier: 'tawakall', type: 'credit_note',
    date: '2026-08-14', customer: 'sultan',
    items: [
      { code: '000014627', name: 'SOFTDREAM M', size: '6x42PC', unitType: 'BAL', ppu: 6, qty: 1, unitCost: 3300, vat: 'A', voided: true },
      { code: '000004392', name: 'CHUNVI', size: '20x1KG', unitType: 'BAL', ppu: 20, qty: 1, unitCost: 600, vat: 'A', voided: true },
    ],
  },

  // ── 5. Mire Shop #0441957 ──
  {
    number: '0441957', supplier: 'mire', type: 'cash_sale',
    date: '2026-08-05', customer: 'GOMAY SHOP',
    items: [
      { code: '000021902', name: 'TOP ONE WATER', size: 'PKT', unitType: 'PKT', ppu: 1, qty: 15, unitCost: 280, vat: 'A' },
      { code: '000003363', name: 'WATER 20L', size: '20L', unitType: 'PC', ppu: 1, qty: 5, unitCost: 100, vat: 'A' },
    ],
  },

  // ── 6. Tawakall #0008280 ──
  {
    number: '0008280', supplier: 'tawakall', type: 'cash_sale',
    date: '2026-08-12', customer: 'SULTAN SHOP',
    items: [
      { code: '000004644', name: 'I.D.P WHITE', size: '10KG', unitType: 'BAG', ppu: 10, qty: 5, unitCost: 1150, vat: 'A' },
      { code: '1000861', name: 'HILWA MILK', size: '6x2.5KG', unitType: 'CTN', ppu: 6, qty: 1, unitCost: 17100, vat: 'A' },
      { code: '000013955', name: 'DOFFY WHITE', size: '10KG', unitType: 'BAL', ppu: 10, qty: 5, unitCost: 1060, vat: 'A' },
      { code: '000003369', name: 'TEA MASALA', size: '12x100GMS', unitType: 'PC', ppu: 12, qty: 6, unitCost: 150, vat: 'A' },
      { code: '000014531', name: 'SNICKERS CHOCO', size: '12x24x50G', unitType: 'PC', ppu: 12, qty: 1, unitCost: 2150, vat: 'A' },
      { code: '000004906', name: 'PAPRIKA MASALA', size: '18x100G', unitType: 'PC', ppu: 18, qty: 6, unitCost: 155, vat: 'B' },
      { code: '000004865', name: 'PILAU MASALA', size: 'PC', unitType: 'PC', ppu: 1, qty: 6, unitCost: 155, vat: 'B' },
      { code: '000003788', name: 'GINGER 100G', size: '100G', unitType: 'PC', ppu: 1, qty: 6, unitCost: 150, vat: 'B' },
      { code: '1000866', name: 'HILWA TUNA', size: '48x95G', unitType: 'CTN', ppu: 48, qty: 1, unitCost: 5350, vat: 'A' },
      { code: '000004604', name: 'VASELINE', size: '144x45ML', unitType: 'DOZ', ppu: 144, qty: 1, unitCost: 700, vat: 'A' },
      { code: '000014680', name: 'OREO ORIGINAL', size: '5x40x24', unitType: 'PC', ppu: 5, qty: 2, unitCost: 900, vat: 'A' },
      { code: '000004236', name: 'OREO CHOCO', size: '8x12x26.25G', unitType: 'PKT', ppu: 8, qty: 2, unitCost: 420, vat: 'A' },
      { code: '000014281', name: 'ARGAN TREATMENT', size: '18x1000ML', unitType: 'PC', ppu: 18, qty: 6, unitCost: 360, vat: 'A' },
      { code: '000014282', name: 'ARGAN SHAMPOO', size: '20x900ML', unitType: 'PC', ppu: 20, qty: 6, unitCost: 420, vat: 'A' },
      { code: '000014283', name: 'ARGAN CONDITIONER', size: '20x1000ML', unitType: 'PC', ppu: 20, qty: 6, unitCost: 420, vat: 'A' },
      { code: '000004437', name: 'NUTELLA CHOCO', size: '15x350G', unitType: 'PC', ppu: 15, qty: 6, unitCost: 570, vat: 'A' },
      { code: '000014724', name: 'HEART CAGE', size: '12x90PC', unitType: 'PC', ppu: 12, qty: 1, unitCost: 570, vat: 'A' },
      { code: '000007605', name: 'AQUA CLEAR', size: '12x500ML', unitType: 'DOZ', ppu: 12, qty: 5, unitCost: 320, vat: 'A' },
      { code: '000014625', name: 'SOFTDREAM XL', size: '6x40PC', unitType: 'BAL', ppu: 6, qty: 1, unitCost: 3300, vat: 'A' },
      { code: '000014626', name: 'SOFTDREAM L', size: '6x42PC', unitType: 'BAL', ppu: 6, qty: 1, unitCost: 3300, vat: 'A' },
      { code: '000004417', name: 'KSL TROPICAL', size: '12x1KG', unitType: 'PKT', ppu: 12, qty: 5, unitCost: 370, vat: 'A' },
      { code: '000004418', name: 'KSL TROPICAL', size: '12x500G', unitType: 'PKT', ppu: 12, qty: 5, unitCost: 200, vat: 'A' },
      // VOIDED — matches credit note 0000606
      { code: '000014627', name: 'SOFTDREAM M', size: '6x42PC', unitType: 'BAL', ppu: 6, qty: 1, unitCost: 3300, vat: 'A', voided: true },
      { code: '1000795', name: 'Z CUSTARD POWDER', size: '12x250G', unitType: 'PC', ppu: 12, qty: 6, unitCost: 100, vat: 'A' },
      { code: '000013947', name: 'Z CUSTARD POWDER', size: '12x500G', unitType: 'PC', ppu: 12, qty: 6, unitCost: 120, vat: 'A' },
      { code: '000003689', name: 'CINNAMON', size: '12x100G', unitType: 'PC', ppu: 12, qty: 6, unitCost: 150, vat: 'A' },
      { code: '000004630', name: 'TUMERIC POWDER', size: 'PC', unitType: 'PC', ppu: 1, qty: 6, unitCost: 150, vat: 'A' },
      // VOIDED — matches credit note 0000606
      { code: '000004392', name: 'CHUNVI', size: '20x1KG', unitType: 'BAL', ppu: 20, qty: 1, unitCost: 600, vat: 'A', voided: true },
    ],
  },

  // ── 7. Tawakall #0007147 ──
  {
    number: '0007147', supplier: 'tawakall', type: 'cash_sale',
    date: '2026-08-14', customer: 'sultan shop 11street',
    items: [
      { code: '000014612', name: 'HILWA CONDENSED MILK', size: '48x390G', unitType: 'PC', ppu: 1, qty: 12, unitCost: 270, vat: 'A' },
      { code: '000004117', name: 'VGG COCONUT CREAM', size: '24x400ML', unitType: 'CTN', ppu: 24, qty: 0.5, unitCost: 4800, vat: 'A' },
      { code: '000004316', name: 'VGG COCONUT MILK', size: '24x400ML', unitType: 'PC', ppu: 24, qty: 12, unitCost: 200, vat: 'B' },
      { code: '1000812', name: 'RAHA DR CHOCO', size: '24x200G', unitType: 'PC', ppu: 24, qty: 6, unitCost: 180, vat: 'B' },
      { code: '1000813', name: 'RAHA DR CHOCO', size: '12x400G', unitType: 'PC', ppu: 12, qty: 6, unitCost: 310, vat: 'A' },
      // VOIDED on receipt
      { code: '000014680', name: 'OREO ORIGINAL', size: '5x40x24', unitType: 'PC', ppu: 5, qty: 1, unitCost: 890, vat: 'A', voided: true },
      { code: '000004878', name: 'TWIST BISCUIT', size: '6x24PC', unitType: 'PKT', ppu: 6, qty: 2, unitCost: 500, vat: 'A' },
      { code: '000014118', name: 'SPACE JUMBO XL', size: '4x60PC', unitType: 'BAL', ppu: 4, qty: 1, unitCost: 4050, vat: 'A' },
      { code: '000004899', name: 'VANILLA POWER', size: 'PKT', unitType: 'PKT', ppu: 1, qty: 5, unitCost: 140, vat: 'B' },
      { code: '000004880', name: 'EVEREADY AA', size: '5xAA', unitType: 'PKT', ppu: 5, qty: 1, unitCost: 2750, vat: 'A' },
      { code: '000004879', name: 'EVEREADY AAA', size: '6xAAA', unitType: 'PKT', ppu: 6, qty: 1, unitCost: 3200, vat: 'A' },
      { code: '000014717', name: 'MUTLU SPAGHETTI', size: '20x500G', unitType: 'CTN', ppu: 20, qty: 2, unitCost: 2350, vat: 'A' },
      { code: '000004259', name: 'SAAD TIMIR', size: '10KG', unitType: 'CTN', ppu: 10, qty: 2, unitCost: 3750, vat: 'B' },
      { code: '000013935', name: 'FOSTER MANGO', size: '10x15x20G', unitType: 'PKT', ppu: 10, qty: 2, unitCost: 580, vat: 'A' },
      { code: '000013934', name: 'FOSTER PINEAPPLE', size: '10x15x20G', unitType: 'PKT', ppu: 10, qty: 2, unitCost: 580, vat: 'A' },
      { code: '000013916', name: 'FOSTER COCKTAIL', size: '10x15x20G', unitType: 'PKT', ppu: 10, qty: 2, unitCost: 580, vat: 'B' },
      { code: '000006574', name: 'FOSTER ORANGE', size: '10x15x20G', unitType: 'PC', ppu: 10, qty: 2, unitCost: 580, vat: 'A' },
      { code: '000005162', name: 'PREDATOR ENERGY', size: '12x400ML', unitType: 'PC', ppu: 12, qty: 2, unitCost: 650, vat: 'A' },
      { code: '000014411', name: 'GX GLASS CLEANER', size: '24x500ML', unitType: 'PC', ppu: 24, qty: 1, unitCost: 2800, vat: 'A' },
      { code: '000014306', name: 'NASH TOMATO', size: '4x5LTR', unitType: 'CTN', ppu: 4, qty: 2, unitCost: 840, vat: 'A' },
      { code: '000004506', name: 'DANA VINEGAR', size: '12x700ML', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 620, vat: 'A' },
      { code: '000004492', name: 'CRYSTAL SHAMPOO', size: '4x5LTR', unitType: 'CTN', ppu: 4, qty: 3, unitCost: 820, vat: 'B' },
      { code: '000004488', name: 'CRYSTAL WHITE', size: '4x5LTR', unitType: 'CTN', ppu: 4, qty: 3, unitCost: 680, vat: 'B' },
      { code: '000014506', name: 'NASH CHILI', size: '4x5LTR', unitType: 'CTN', ppu: 4, qty: 2, unitCost: 820, vat: 'A' },
      { code: '000013989', name: 'POPCO OIL', size: '6x2LTR', unitType: 'CTN', ppu: 6, qty: 1, unitCost: 3250, vat: 'A' },
      { code: '000004384', name: 'ABU WALAD BISCUIT', size: '48x100G', unitType: 'CTN', ppu: 48, qty: 1, unitCost: 2200, vat: 'B' },
      { code: '000008699', name: 'BROOKSIDE MILK TIN', size: '12x900G', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 11600, vat: 'A' },
      { code: '1000762', name: 'BLUE BAND', size: '12x1KG', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 5650, vat: 'A' },
    ],
  },

  // ── 8. G-Wholesalers #0038473 ──
  {
    number: '0038473', supplier: 'gwholesalers', type: 'cash_sale',
    date: '2026-08-16', customer: 'MABRUUK',
    items: [
      { code: '000002074', name: 'COLGATE JUNIOR 65', size: 'DRS', unitType: 'PC', ppu: 1, qty: 1, unitCost: 2215, vat: 'A' },
      { code: '000002230', name: 'USHINDI DISHWASHING PASTE', size: 'PC', unitType: 'PC', ppu: 1, qty: 4, unitCost: 370, vat: 'A' },
      { code: '000002479', name: 'SAFI INSTANT 11G', size: '11G', unitType: 'PC', ppu: 1, qty: 1, unitCost: 170, vat: 'B' },
      { code: '000002649', name: 'DABUR VALUE PARK 150GM', size: '150GM', unitType: 'PC', ppu: 1, qty: 12, unitCost: 230, vat: 'A' },
      { code: '000001674', name: 'DAIMA', size: '18x500ML', unitType: 'CTN', ppu: 18, qty: 1, unitCost: 940, vat: 'B' },
      { code: '000003282', name: 'ARIMIS', size: '12x90G', unitType: 'PC', ppu: 12, qty: 1, unitCost: 670, vat: 'B' },
      { code: '000002196', name: 'KENTASTE COCONUT', size: '12x500ML', unitType: 'PC', ppu: 12, qty: 4, unitCost: 560, vat: 'A' },
      { code: '000002346', name: 'KENTASTE COCONUT 200ML', size: '200ML', unitType: 'PC', ppu: 1, qty: 4, unitCost: 290, vat: 'A' },
      { code: '000002536', name: 'DOWNY', size: '900MLx12', unitType: 'PC', ppu: 12, qty: 3, unitCost: 670, vat: 'B' },
      { code: '000001407', name: 'STA SOFT', size: '24x750ML', unitType: 'PC', ppu: 24, qty: 3, unitCost: 310, vat: 'A' },
      { code: '000002512', name: 'GOOD DOCTOR TOOTHBRUSH', size: 'PC', unitType: 'PC', ppu: 1, qty: 2, unitCost: 1650, vat: 'A' },
      { code: '000001775', name: 'POPCO 500ML', size: '500ML', unitType: 'PC', ppu: 1, qty: 0.5, unitCost: 1950, vat: 'B' },
      { code: '000002170', name: 'POPCO', size: '12x1LTR', unitType: 'PC', ppu: 12, qty: 6, unitCost: 290, vat: 'A' },
      { code: '000001694', name: 'KENSALT', size: '20x1KG', unitType: 'CTN', ppu: 20, qty: 1, unitCost: 650, vat: 'A' },
      { code: '000001777', name: 'HAMZA RICE', size: '25KG', unitType: 'BAG', ppu: 25, qty: 1, unitCost: 4250, vat: 'B' },
      { code: '000001838', name: 'AHLAN RICE 25KG', size: '25KG', unitType: 'BAG', ppu: 25, qty: 1, unitCost: 4150, vat: 'B' },
      { code: '000004093', name: 'AJAB NGANO', size: '24x500G', unitType: 'BAL', ppu: 24, qty: 1, unitCost: 1050, vat: 'B' },
      { code: '000003978', name: 'AJAB NGANO', size: '24x1KG', unitType: 'BAL', ppu: 24, qty: 1, unitCost: 2100, vat: 'B' },
      { code: '000002079', name: 'BROOKSIDE 200ML', size: '24x200ML', unitType: 'CTN', ppu: 24, qty: 1, unitCost: 640, vat: 'B' },
      { code: '000002777', name: 'PRESTIGE 250G', size: '250G', unitType: 'PC', ppu: 1, qty: 5, unitCost: 130, vat: 'A' },
      { code: '000002928', name: 'BABY SOAP', size: 'PC', unitType: 'PC', ppu: 1, qty: 6, unitCost: 95, vat: 'A' },
      { code: '10000320', name: 'VATIKA OIL', size: 'PC', unitType: 'PC', ppu: 1, qty: 6, unitCost: 375, vat: 'A' },
      { code: '000003043', name: 'AMERICAN DREAM', size: 'PC', unitType: 'PC', ppu: 1, qty: 8, unitCost: 780, vat: 'B' },
      { code: '10000388b', name: 'GLACIER WATER 5LTR', size: '5LTR', unitType: 'PC', ppu: 1, qty: 1, unitCost: 360, vat: 'A' },
      { code: '000001061', name: 'GLACIER WATER 1.5L', size: '1.5L', unitType: 'PC', ppu: 1, qty: 1, unitCost: 360, vat: 'A' },
      { code: '000001778', name: 'GLACIER WATER 500ML', size: '500ML', unitType: 'PC', ppu: 1, qty: 1, unitCost: 360, vat: 'A' },
      { code: '000002433', name: 'AQUA CLEAR 1LT', size: '1LT', unitType: 'BAL', ppu: 1, qty: 1, unitCost: 560, vat: 'A' },
      { code: '000001250', name: 'DANA CHILI', size: '24x250G', unitType: 'CTN', ppu: 24, qty: 0.5, unitCost: 1200, vat: 'A' },
      { code: '10000935', name: 'CRACKED WHEAT SAREN', size: '20x1KG', unitType: 'PC', ppu: 20, qty: 10, unitCost: 185, vat: 'B' },
      { code: '000002492', name: 'LEMON 300ML', size: '300ML', unitType: 'PC', ppu: 1, qty: 1, unitCost: 470, vat: 'A' },
    ],
  },

  // ── 9. G-Wholesalers #0038476 ──
  {
    number: '0038476', supplier: 'gwholesalers', type: 'cash_sale',
    date: '2026-08-16', customer: 'H',
    items: [
      { code: '000001414', name: 'INDOMIE', size: '20x120GMS', unitType: 'CTN', ppu: 20, qty: 1, unitCost: 750, vat: 'A' },
    ],
  },

  // ── 10. Tawakall #0006728 (big order — 107 lines) ──
  {
    number: '0006728', supplier: 'tawakall', type: 'cash_sale',
    date: '2026-08-14', customer: 'mubarak sultan shop',
    items: [
      { code: '000003978', name: 'AJAB NGANO', size: '24x1KG', unitType: 'BAL', ppu: 24, qty: 3, unitCost: 1980, vat: 'A' },
      { code: '000003680', name: 'YUMIS', size: '20x500G', unitType: 'CTN', ppu: 20, qty: 1, unitCost: 5800, vat: 'B' },
      { code: '000010718', name: 'NUT GOLD BLUE', size: '12x400G', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 2650, vat: 'B' },
      { code: '000005140', name: 'NUT GOLD BLUE', size: '12x250G', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 1950, vat: 'B' },
      { code: '000005479', name: 'ZESTA JAM', size: '12x900G', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 3600, vat: 'B' },
      { code: '000012754', name: 'ZESTA JAM', size: '12x450G', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 2050, vat: 'B' },
      { code: '000004158', name: 'KEN FRESH TEA', size: '20x500G', unitType: 'CTN', ppu: 20, qty: 1, unitCost: 3250, vat: 'A' },
      { code: '000013932', name: 'BIGG DADDY LOLLIPOP', size: '16x50PC', unitType: 'PKT', ppu: 16, qty: 3, unitCost: 280, vat: 'B' },
      { code: '000004471', name: 'FAHARI TEA', size: '20x50G', unitType: 'PKT', ppu: 20, qty: 1, unitCost: 200, vat: 'A' },
      { code: '000004472', name: 'FAHARI TEA', size: '10x100G', unitType: 'PKT', ppu: 10, qty: 2, unitCost: 370, vat: 'A' },
      { code: '1001249', name: 'NESCAFE', size: '24x50G', unitType: 'CTN', ppu: 24, qty: 0.5, unitCost: 7100, vat: 'B' },
      { code: '000004467', name: 'HEINZ KETCHUP', size: '10x570G', unitType: 'CTN', ppu: 10, qty: 1, unitCost: 3800, vat: 'B' },
      { code: '000004383', name: 'BLUE BAND', size: '24x500G', unitType: 'CTN', ppu: 24, qty: 0.5, unitCost: 5800, vat: 'B' },
      { code: '1000761', name: 'BLUE BAND', size: '48x100G', unitType: 'DOZ', ppu: 48, qty: 2, unitCost: 700, vat: 'B' },
      { code: '1000763', name: 'BLUE BAND', size: '48x250G', unitType: 'DOZ', ppu: 48, qty: 2, unitCost: 1600, vat: 'B' },
      { code: '000004420', name: 'DANA CHILI', size: '24x250ML', unitType: 'CTN', ppu: 24, qty: 1, unitCost: 1050, vat: 'B' },
      { code: '000014090', name: 'ZESTA KETCHUP', size: '12x700G', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 2800, vat: 'B' },
      { code: '000004518', name: 'KERICHO GOLD', size: '24x250G', unitType: 'CTN', ppu: 24, qty: 1, unitCost: 4150, vat: 'A' },
      { code: '000005142', name: 'KERICHO GOLD', size: '12x100G', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 2800, vat: 'A' },
      { code: '000004634', name: 'BATOOK GUM', size: '50x20x5PC', unitType: 'PKT', ppu: 50, qty: 5, unitCost: 200, vat: 'B' },
      { code: '000005288', name: 'MABUYUZ GUM', size: '20x50PC', unitType: 'CTN', ppu: 20, qty: 1, unitCost: 1600, vat: 'B' },
      { code: '000014686', name: 'CHOCO LICIOUS BISCUIT', size: '96x50G', unitType: 'CTN', ppu: 96, qty: 0.5, unitCost: 6400, vat: 'B' },
      { code: '000013936', name: 'LINDO CAKE', size: '6x24x45G', unitType: 'CTN', ppu: 6, qty: 1, unitCost: 3900, vat: 'B' },
      { code: '000014383', name: 'HEART CHOCO', size: '12x84PC', unitType: 'PKT', ppu: 12, qty: 1, unitCost: 570, vat: 'B' },
      { code: '1001022', name: 'SALAMA OATS', size: '9x1KG', unitType: 'CTN', ppu: 9, qty: 1, unitCost: 2510, vat: 'B' },
      { code: '000014703', name: 'BUBBLY CHOCO', size: '12x24G', unitType: 'PKT', ppu: 12, qty: 1, unitCost: 1000, vat: 'B' },
      { code: '000004093', name: 'AJAB NGANO', size: '24x500G', unitType: 'BAL', ppu: 24, qty: 5, unitCost: 1000, vat: 'A' },
      { code: '000004210', name: 'SUGAR BROWN', size: '50KG', unitType: 'BAG', ppu: 50, qty: 2, unitCost: 6450, vat: 'B' },
      { code: '000014711', name: 'TURK SPAGHETTI', size: '20x500G', unitType: 'CTN', ppu: 20, qty: 2, unitCost: 2300, vat: 'A' },
      { code: '000008691', name: 'GOLDA MACARONI ELBOW', size: '20x500G', unitType: 'CTN', ppu: 20, qty: 2, unitCost: 1900, vat: 'B' },
      { code: '000008690', name: 'GOLDA MACARONI SHORT', size: '20x500G', unitType: 'CTN', ppu: 20, qty: 2, unitCost: 1900, vat: 'B' },
      { code: '000004393', name: 'CHUNVI', size: '30x200G', unitType: 'BAL', ppu: 30, qty: 2, unitCost: 270, vat: 'B' },
      { code: '000014369', name: 'RAHA UGALI', size: '24x1KG', unitType: 'BAL', ppu: 24, qty: 1, unitCost: 2270, vat: 'A' },
      { code: '000013988', name: 'PIKA OIL 10LTR', size: '10LTR', unitType: 'PC', ppu: 1, qty: 2, unitCost: 2450, vat: 'B' },
      { code: '1001028', name: 'POPCO OIL', size: '4x5LT', unitType: 'CTN', ppu: 4, qty: 1, unitCost: 5100, vat: 'B' },
      { code: '1001027', name: 'POPCO OIL', size: '6x3LT', unitType: 'CTN', ppu: 6, qty: 1, unitCost: 4850, vat: 'B' },
      { code: '000013989', name: 'POPCO OIL', size: '6x2LTR', unitType: 'CTN', ppu: 6, qty: 1, unitCost: 3270, vat: 'B' },
      { code: '1001523', name: 'SAHAL RICE 25KG', size: '25KG', unitType: 'BAG', ppu: 25, qty: 2, unitCost: 4050, vat: 'A' },
      { code: '1001386', name: 'WHITE WASH', size: '48x175G', unitType: 'CTN', ppu: 48, qty: 2, unitCost: 1570, vat: 'B' },
      { code: '1000877', name: 'JAMAA SOAP BIG', size: '25x800G', unitType: 'CTN', ppu: 25, qty: 2, unitCost: 3900, vat: 'B' },
      { code: '1001084', name: 'FARAGELLO TOMATO', size: '4x25x50G', unitType: 'CTN', ppu: 4, qty: 1, unitCost: 1400, vat: 'B' },
      { code: '000011734', name: 'GILDA BEANS', size: '24x400G', unitType: 'CTN', ppu: 24, qty: 1, unitCost: 1650, vat: 'B' },
      { code: '000013825', name: 'SOFTCARE ALWAYS', size: '24x8PC', unitType: 'CTN', ppu: 24, qty: 1, unitCost: 1550, vat: 'A' },
      { code: '000013973', name: 'SOFTCARE WIPES', size: '12x80PC', unitType: 'CTN', ppu: 12, qty: 2, unitCost: 1600, vat: 'B' },
      { code: '000005447', name: 'ASANTA GREEN GRAMS', size: '48x500G', unitType: 'PC', ppu: 48, qty: 1, unitCost: 4200, vat: 'A' },
      { code: '000004426', name: 'JUICY FRUIT GUM', size: '36x50PC', unitType: 'PKT', ppu: 36, qty: 2, unitCost: 370, vat: 'B' },
      { code: '000005278', name: 'MM TROPICAL', size: '12x400ML', unitType: 'DOZ', ppu: 12, qty: 1, unitCost: 850, vat: 'B' },
      { code: '000004222', name: 'MM MANGO', size: '12x400ML', unitType: 'DOZ', ppu: 12, qty: 1, unitCost: 850, vat: 'B' },
      { code: '000005277', name: 'MM APPLE', size: '12x400ML', unitType: 'DOZ', ppu: 12, qty: 1, unitCost: 850, vat: 'B' },
      { code: '000005407', name: 'BRAVA APPLE', size: '12x300ML', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 400, vat: 'B' },
      { code: '000005408', name: 'BRAVA MANGO', size: '12x300ML', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 400, vat: 'B' },
      { code: '000004230', name: 'SODA COCA COLA', size: '24x350ML', unitType: 'CTN', ppu: 24, qty: 1, unitCost: 980, vat: 'B' },
      { code: '000005262', name: 'SODA BLACK CURRANT', size: '24x350ML', unitType: 'CTN', ppu: 24, qty: 1, unitCost: 980, vat: 'B' },
      { code: '000005261', name: 'SODA ORANGE', size: '24x350ML', unitType: 'CTN', ppu: 24, qty: 1, unitCost: 980, vat: 'B' },
      { code: '000005280', name: 'SODA SPRITE', size: '24x350ML', unitType: 'DOZ', ppu: 24, qty: 1, unitCost: 1600, vat: 'B' },
      { code: '000007610', name: 'MM TROPICAL', size: '12x1L', unitType: 'DOZ', ppu: 12, qty: 1, unitCost: 1600, vat: 'B' },
      { code: '000004641', name: 'MM MANGO JUICE', size: '12x1LTR', unitType: 'DOZ', ppu: 12, qty: 1, unitCost: 1600, vat: 'B' },
      { code: '000007608', name: 'MM APPLE', size: '12x1L', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 14200, vat: 'B' },
      { code: '000005292', name: 'BROOKSIDE MILK TIN', size: '6x2.5KG', unitType: 'CTN', ppu: 6, qty: 1, unitCost: 13600, vat: 'B' },
      { code: '000013801', name: 'LATO MILK', size: '6x2.5KG', unitType: 'CTN', ppu: 6, qty: 1, unitCost: 2350, vat: 'A' },
      { code: '000005176', name: 'NAJAH UJI', size: '6x2KG', unitType: 'CTN', ppu: 6, qty: 0.5, unitCost: 8500, vat: 'B' },
      { code: '000007652', name: 'WEETABIX', size: '24x425G', unitType: 'CTN', ppu: 24, qty: 0.5, unitCost: 7600, vat: 'B' },
      { code: '1000111', name: 'WEETABIX', size: '12x850G', unitType: 'CTN', ppu: 12, qty: 0.5, unitCost: 4400, vat: 'A' },
      { code: '000005354', name: 'SUMMER SHAMPOO', size: '24x1380ML', unitType: 'CTN', ppu: 24, qty: 0.5, unitCost: 2200, vat: 'B' },
      { code: '000005454', name: 'HAND WASH', size: '24x500ML', unitType: 'CTN', ppu: 24, qty: 5, unitCost: 110, vat: 'A' },
      { code: '1000832', name: 'FOOD COLOUR', size: 'DOZ', unitType: 'DOZ', ppu: 12, qty: 10, unitCost: 420, vat: 'B' },
      { code: '000005341', name: 'DOVE SHAMPOO', size: '24x400ML', unitType: 'PC', ppu: 24, qty: 6, unitCost: 140, vat: 'B' },
      { code: '000014684', name: 'RDL SOAP', size: '96x135G', unitType: 'PC', ppu: 96, qty: 6, unitCost: 140, vat: 'B' },
      { code: '000014033', name: 'TAAM TREATMENT', size: '24x1000G', unitType: 'PC', ppu: 24, qty: 6, unitCost: 200, vat: 'A' },
      { code: '000013855', name: 'MAYONNAISE TREATMENT', size: '24x1000G', unitType: 'PC', ppu: 24, qty: 0.5, unitCost: 7300, vat: 'A' },
      { code: '000005481', name: 'CBC TIN', size: '24x325G', unitType: 'CTN', ppu: 24, qty: 0.5, unitCost: 5700, vat: 'B' },
      { code: '000004312', name: 'CBC PALM OIL', size: '20x500ML', unitType: 'CTN', ppu: 20, qty: 0.5, unitCost: 5100, vat: 'A' },
      { code: '000014282b', name: 'ARGAN SHAMPOO', size: '20x900ML', unitType: 'PC', ppu: 20, qty: 6, unitCost: 420, vat: 'B' },
      { code: '000003713', name: 'BABY SHAMPOO', size: '12x300ML', unitType: 'CTN', ppu: 12, qty: 0.5, unitCost: 4000, vat: 'B' },
      { code: '000010723', name: 'BABY OIL', size: '12x300ML', unitType: 'CTN', ppu: 12, qty: 0.5, unitCost: 4700, vat: 'B' },
      { code: '000003864', name: 'JUMBO CHICKEN', size: '24x48x480G', unitType: 'PKT', ppu: 24, qty: 4, unitCost: 290, vat: 'A' },
      { code: '000013894', name: 'COLGATE RED', size: '144x35G', unitType: 'DOZ', ppu: 144, qty: 1, unitCost: 750, vat: 'B' },
      { code: '000004206', name: 'SOFTCARE XL', size: '6x36PC', unitType: 'BAL', ppu: 6, qty: 1, unitCost: 3900, vat: 'B' },
      { code: '000003854', name: 'SOFTCARE S', size: '6x48PC', unitType: 'BAL', ppu: 6, qty: 1, unitCost: 3900, vat: 'B' },
      { code: '000003855', name: 'SOFTCARE M', size: '6x42PC', unitType: 'BAL', ppu: 6, qty: 1, unitCost: 3900, vat: 'B' },
      { code: '000014693', name: 'DOVE SOAP', size: '48x135G', unitType: 'PC', ppu: 48, qty: 12, unitCost: 150, vat: 'B' },
      { code: '000004821', name: 'DETTOL SOAP', size: '72x90G', unitType: 'PC', ppu: 72, qty: 12, unitCost: 50, vat: 'B' },
      { code: '000004029', name: 'AMARA LOTION', size: '12x400ML', unitType: 'CTN', ppu: 12, qty: 1, unitCost: 2800, vat: 'B' },
      { code: '000003424', name: 'NASEEM AIRFRESH', size: '60x300ML', unitType: 'PC', ppu: 60, qty: 7, unitCost: 470, vat: 'B' },
      { code: '000003517', name: 'AIRFRESH DIRHAM', size: '72x300ML', unitType: 'PC', ppu: 72, qty: 10, unitCost: 250, vat: 'B' },
      { code: '000014217', name: 'OLIVITA OIL', size: '12x250ML', unitType: 'CTN', ppu: 12, qty: 0.5, unitCost: 3300, vat: 'B' },
      { code: '000004021', name: 'COLGATE RED', size: '72x100G', unitType: 'DOZ', ppu: 72, qty: 1, unitCost: 1550, vat: 'B' },
      { code: '000004104', name: 'COLGATE HERBAL', size: '72x100G', unitType: 'DOZ', ppu: 72, qty: 1, unitCost: 1550, vat: 'B' },
      { code: '000004763', name: 'CHARCOAL', size: '32x10PC', unitType: 'PKT', ppu: 32, qty: 6, unitCost: 300, vat: 'A' },
      { code: '000014153', name: 'MOMEASY WIPER', size: '24x80PC', unitType: 'CTN', ppu: 24, qty: 1, unitCost: 3200, vat: 'A' },
      { code: '000004717', name: 'COLGATE RED SACHET', size: '12x24x15ML', unitType: 'PC', ppu: 12, qty: 1, unitCost: 700, vat: 'B' },
      { code: '000004550', name: 'SHENKE MOSQUITO', size: 'PC', unitType: 'PC', ppu: 1, qty: 10, unitCost: 80, vat: 'B' },
      { code: '000004584', name: 'SHENKE ELECTRIC', size: '120PC', unitType: 'PKT', ppu: 120, qty: 10, unitCost: 70, vat: 'A' },
      { code: '000009712', name: 'COLGATE TB ANTICAVITY', size: '144', unitType: 'DOZ', ppu: 144, qty: 2, unitCost: 360, vat: 'B' },
      { code: '000014344', name: 'BELLA SERVIETTES', size: '18x100PC', unitType: 'BAL', ppu: 18, qty: 1, unitCost: 1150, vat: 'B' },
      { code: '000014094', name: 'BELLA TOILET PAPER', size: '40x10PC', unitType: 'CTN', ppu: 40, qty: 1, unitCost: 1200, vat: 'B' },
      { code: '000005376', name: 'SAHAL RICE', size: '8x5KG', unitType: 'BAG', ppu: 8, qty: 0.5, unitCost: 6400, vat: 'A' },
      { code: '000003783', name: 'HEAD & SHOULDERS', size: '24x400ML', unitType: 'PC', ppu: 24, qty: 12, unitCost: 470, vat: 'B' },
      { code: '000005225', name: 'PANTENE SHAMPOO', size: '24x400ML', unitType: 'PC', ppu: 24, qty: 12, unitCost: 370, vat: 'B' },
      { code: '000003675', name: 'RINSUN SUNFLOWER OIL', size: '6x3LT', unitType: 'CTN', ppu: 6, qty: 1, unitCost: 6700, vat: 'B' },
      { code: '000004438', name: 'ROYCO CUBE', size: '24x40x4G', unitType: 'PKT', ppu: 24, qty: 5, unitCost: 170, vat: 'B' },
      { code: '000007598', name: 'OMAAR TUNA S', size: '48x95G', unitType: 'CTN', ppu: 48, qty: 1, unitCost: 5250, vat: 'B' },
      { code: '000014002', name: 'BOUTIQUE SHAMPOO', size: '12x1000ML', unitType: 'CTN', ppu: 12, qty: 0.5, unitCost: 5600, vat: 'B' },
      { code: '000004514', name: 'ATTA MARK', size: '24x1KG', unitType: 'BAL', ppu: 24, qty: 1, unitCost: 3050, vat: 'A' },
      { code: '1001673', name: 'VIM POWDER', size: '24x500G', unitType: 'PC', ppu: 24, qty: 12, unitCost: 120, vat: 'B' },
      { code: '000014619', name: 'BIO BRIGHT', size: '24x750ML', unitType: 'PC', ppu: 24, qty: 12, unitCost: 140, vat: 'B' },
    ],
  },
]

// ── Seeder logic ────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('confirm') !== 'yes') {
    return NextResponse.json({ error: 'Pass ?confirm=yes' }, { status: 400 })
  }

  const log: string[] = []

  // 1. Create suppliers
  const supplierIds: Record<string, string> = {}
  for (const s of SUPPLIERS) {
    const { data, error } = await supabase.from('suppliers').insert({
      name: s.name,
      address: s.address,
      phone: s.phone,
      kra_pin: 'kra_pin' in s ? s.kra_pin : null,
      agent_no: 'agent_no' in s ? s.agent_no : null,
      store_no: 'store_no' in s ? s.store_no : null,
    }).select('id').single()
    if (error) { log.push(`supplier ${s.key}: ERROR - ${error.message}`); continue }
    supplierIds[s.key] = data.id
    log.push(`supplier: ${s.name} (${data.id})`)
  }

  // 2. Deduplicate products by code — collect all unique products
  // For same code appearing multiple times, use the LATEST receipt's price
  // Items with 'b' suffix on code (like '10000388b', '000014282b') are same product
  // bought from different supplier — normalize the code
  interface ProductDef {
    code: string
    name: string
    size: string
    unitType: UnitType
    ppu: number
    unitCost: number   // cost per unit (latest)
    vat: 'A' | 'B'
    supplierKey: string
    category: string
    date: string       // for "latest price" logic
  }

  const productMap = new Map<string, ProductDef>()

  for (const receipt of RECEIPTS) {
    for (const item of receipt.items) {
      if (item.name === 'DISCOUNT') continue
      const code = item.code.replace(/[a-z]$/, '') // strip trailing 'b' etc.
      const existing = productMap.get(code)
      if (!existing || receipt.date > existing.date) {
        productMap.set(code, {
          code,
          name: item.name,
          size: item.size,
          unitType: item.unitType,
          ppu: item.ppu,
          unitCost: item.unitCost,
          vat: item.vat,
          supplierKey: receipt.supplier,
          category: assignCategory(item.name),
          date: receipt.date,
        })
      }
    }
  }

  log.push(`unique products: ${productMap.size}`)

  // 3. Insert all products
  const productIds: Record<string, string> = {} // code → id

  for (const [code, p] of productMap) {
    const buyPricePerPiece = p.ppu > 1 ? Math.round((p.unitCost / p.ppu) * 100) / 100 : p.unitCost
    const sellPrice = p.unitCost  // default: sell at cost (user sets real prices)
    const sellPricePiece = p.ppu > 1 ? Math.round(sellPrice / p.ppu) : null

    const supplierId = supplierIds[p.supplierKey] || null
    const supplierName = SUPPLIERS.find(s => s.key === p.supplierKey)?.name || null

    const { data, error } = await supabase.from('products').insert({
      name: p.name,
      code: p.code,
      size: p.size,
      unit_type: p.unitType,
      pieces_per_unit: p.ppu,
      buy_price: buyPricePerPiece,
      sell_price: sellPrice,
      sell_price_piece: sellPricePiece,
      stock_qty: 0,
      min_stock: 5,
      category: p.category,
      vat_class: p.vat,
      supplier_name: supplierName,
      supplier_id: supplierId,
      is_active: true,
    }).select('id').single()

    if (error) {
      log.push(`product ${code} (${p.name}): ERROR - ${error.message}`)
      continue
    }
    productIds[code] = data.id
  }

  log.push(`products created: ${Object.keys(productIds).length}`)

  // 4. Create stock entries per receipt line (triggers update stock_qty)
  // Skip: voided items, credit note items, DISCOUNT lines
  let stockCount = 0
  let skippedVoided = 0

  for (const receipt of RECEIPTS) {
    for (const item of receipt.items) {
      if (item.name === 'DISCOUNT') continue
      if (item.voided) { skippedVoided++; continue }
      if (receipt.type === 'credit_note') { skippedVoided++; continue }

      const code = item.code.replace(/[a-z]$/, '')
      const productId = productIds[code]
      if (!productId) continue

      const supplierId = supplierIds[receipt.supplier] || null
      const supplierName = SUPPLIERS.find(s => s.key === receipt.supplier)?.name || null
      const buyPricePerPiece = item.ppu > 1 ? Math.round((item.unitCost / item.ppu) * 100) / 100 : item.unitCost
      const qtyInPieces = Math.round(item.qty * item.ppu)

      if (qtyInPieces <= 0) continue

      const { error } = await supabase.from('stock_entries').insert({
        product_id: productId,
        quantity: qtyInPieces,
        buy_price: buyPricePerPiece,
        supplier: supplierName,
        supplier_id: supplierId,
        notes: `Receipt #${receipt.number}`,
      })

      if (error) {
        log.push(`stock ${code}: ERROR - ${error.message}`)
      } else {
        stockCount++
      }
    }
  }

  log.push(`stock entries: ${stockCount} created, ${skippedVoided} voided/credit skipped`)

  // 5. Create purchase order records for each receipt
  let poCount = 0
  for (const receipt of RECEIPTS) {
    const supplierDef = SUPPLIERS.find(s => s.key === receipt.supplier)
    const supplierId = supplierIds[receipt.supplier] || null
    const totalAmount = receipt.items
      .filter(i => i.name !== 'DISCOUNT' && !i.voided)
      .reduce((s, i) => s + i.qty * i.unitCost, 0)

    const { data: po, error: poErr } = await supabase.from('purchase_orders').insert({
      supplier_name: supplierDef?.name || receipt.supplier,
      supplier_phone: supplierDef?.phone || null,
      supplier_id: supplierId,
      total_amount: Math.abs(totalAmount),
      paid_amount: Math.abs(totalAmount),
      receipt_number: receipt.number,
      receipt_type: receipt.type,
      customer_name: receipt.customer,
      notes: receipt.type === 'credit_note' ? 'Credit note — items returned' : null,
    }).select('id').single()

    if (poErr) {
      log.push(`PO ${receipt.number}: ERROR - ${poErr.message}`)
    } else {
      // Insert PO items
      const poItems = receipt.items
        .filter(i => i.name !== 'DISCOUNT')
        .map(i => {
          const code = i.code.replace(/[a-z]$/, '')
          return {
            purchase_order_id: po.id,
            product_id: productIds[code] || null,
            product_name: i.name,
            quantity: i.qty,
            buy_price: i.unitCost,
            line_total: i.qty * i.unitCost,
            supplier_code: code,
            vat_class: i.vat,
            unit_type: i.unitType,
          }
        })

      const { error: itemErr } = await supabase.from('purchase_order_items').insert(poItems)
      if (itemErr) {
        log.push(`PO items ${receipt.number}: ERROR - ${itemErr.message}`)
      } else {
        poCount++
        log.push(`PO: #${receipt.number} (${receipt.type}) — ${receipt.items.length} items`)
      }
    }
  }

  log.push(`purchase orders: ${poCount} created`)

  // Summary
  const totalProducts = Object.keys(productIds).length
  const { data: stockCheck } = await supabase.from('products').select('id, name, stock_qty').gt('stock_qty', 0).order('name')
  log.push(`products with stock > 0: ${stockCheck?.length ?? 0}`)

  return NextResponse.json({
    status: 'done',
    summary: {
      suppliers: Object.keys(supplierIds).length,
      products: totalProducts,
      stockEntries: stockCount,
      purchaseOrders: poCount,
      voidedSkipped: skippedVoided,
    },
    log,
  })
}
