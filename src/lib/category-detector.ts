/**
 * Category Detector
 * Maps product names from supplier receipts to store categories
 * using keyword matching against the 14 predefined categories.
 */

const CATEGORY_KEYWORDS: [string, string[]][] = [
  ['Staples & Flour', [
    'FLOUR', 'WHEAT', 'MAIZE', 'RICE', 'SPAGHETTI', 'SPGT', 'PASTA',
    'SUGAR', 'SALT', 'I.D.P', 'IDP', 'DOFFY', 'UGALI',
  ]],
  ['Canned & Sauces', [
    'TUNA', 'CANNED', 'TOMATO', 'TMT', 'KETCHUP', 'SAUCE', 'VINEG',
    'CHILI', 'HILWA TUNA', 'DANA', 'BEANS', 'PEAS',
  ]],
  ['Dairy & Spreads', [
    'MILK', 'CREAM', 'BUTTER', 'GHEE', 'CHEESE', 'YOGHURT',
    'BLUE BAND', 'BROOKSIDE', 'NUTELLA', 'CONDENSED', 'CNDND',
    'MARGARINE', 'SPREAD', 'HILWA MILK', 'HILWA CNDND',
  ]],
  ['Cooking Oils', [
    'OIL', 'POPCO', 'SUNFLOWER', 'VEGETABLE OIL', 'FRYING', 'CCNT CREAM',
    'COCONUT', 'VGG CCNT', 'OLIVE',
  ]],
  ['Snacks & Confectionery', [
    'BISCUIT', 'BSCT', 'CHOCOLATE', 'CHOCO', 'CANDY', 'SWEET',
    'OREO', 'SNICKERS', 'TWIST', 'WAFER', 'CHIPS', 'CRISP',
    'RAHA', 'WALAD', 'ABU WALAD', 'TOFFEE', 'GUM',
  ]],
  ['Hot Beverages', [
    'TEA', 'COFFEE', 'COCOA', 'MASALA', 'CHAI',
  ]],
  ['Cold Beverages', [
    'JUICE', 'DRINK', 'ENERGY', 'SODA', 'WATER', 'AQUA',
    'PREDATOR', 'FOSTER', 'MANGO', 'PINEAPPLE', 'PNPL', 'ORONGE',
    'COCKTAIL', 'CCKTL', 'TROPICAL', 'KSL',
  ]],
  ['Porridge & Baking', [
    'PORRIDGE', 'BAKING', 'YEAST', 'CUSTARD', 'VANILLA',
    'POWER', 'MAGEST',
  ]],
  ['Cleaning & Household', [
    'CLEANER', 'DETERGENT', 'SOAP', 'BLEACH', 'STEEL WOOL',
    'CRYSTAL', 'NASH', 'GX GLASS', 'BRUSH', 'SPONGE', 'CLOTH',
    'POLISH', 'DISINFECT',
  ]],
  ['Toiletries & Personal Care', [
    'SHAMPOO', 'SHMP', 'CONDITIONER', 'COND', 'LOTION', 'VASELIN',
    'ARGAN', 'TREANT', 'TREATMENT', 'PERFUME', 'DEODORANT',
    'TOOTHPASTE', 'TOOTH', 'BODY', 'SKIN', 'HAIR',
  ]],
  ['Paper Products', [
    'TISSUE', 'TOILET', 'SERVIETTE', 'NAPKIN', 'KITCHEN ROLL',
    'DIAPER', 'NAPPY', 'JUMBO ROLL', 'JUMBO TISSUE', 'SPACE', 'SOFTDREAM', 'WIPE',
    'HEART CAG',
  ]],
  ['Fragrance & Air Care', [
    'FRAGRANCE', 'AIR FRESH', 'INCENSE', 'BUKHOOR', 'ROOM SPRAY',
    'SCENT',
  ]],
  ['Cooking Aids', [
    'SPICE', 'PILAU', 'PAPRIKA', 'GINGER', 'CINNAMON', 'TUMERIC',
    'TURMERIC', 'CUMIN', 'CURRY', 'PEPPER', 'CARDAMOM',
    'DATES', 'TIMIR', 'SAAD',
  ]],
  ['Batteries & Electronics', [
    'BATTERY', 'EVEREADY', 'CHARGER', 'BULB', 'TORCH', 'CABLE',
  ]],
]

/**
 * Detect product category from name using keyword matching.
 * Returns the best matching category or null if no confident match.
 */
export function detectCategory(productName: string): string | null {
  const upper = productName.toUpperCase()
  const words = upper.split(/[\s/\-()]+/).filter(w => w.length > 1)

  let bestMatch: string | null = null
  let bestScore = 0

  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    let score = 0
    for (const kw of keywords) {
      // Multi-word keywords: check if full phrase is in the name
      if (kw.includes(' ')) {
        if (upper.includes(kw)) score += 3
      } else {
        // Single word: check word match or substring
        if (words.includes(kw)) score += 2
        else if (upper.includes(kw)) score += 1
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = category
    }
  }

  // Require a minimum confidence (at least one exact word match)
  return bestScore >= 2 ? bestMatch : null
}
