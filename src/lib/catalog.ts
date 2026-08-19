export type CatalogGroup = {
  label: string      // e.g. "Rice", "Flour", "Sugar"
  brands: string[]   // brands relevant to this base
  subtypes: string[] // specific subtypes within this base
  sizes?: string[]   // overrides parent sizes when set
}

export type CatalogEntry = {
  brands: string[]          // used when no groups defined
  subtypes: string[]        // used when no groups defined
  sizes: string[]
  groups?: CatalogGroup[]   // when present, Step 2 = group picker, not brand
}

/**
 * Pre-loaded catalog for Nairobi / Eastleigh food stores.
 * Keys must match PRODUCT_CATEGORIES in types.ts.
 * Every list ends with 'Other' as escape hatch.
 */
export const CATALOG: Record<string, CatalogEntry> = {
  'Staples & Flour': {
    sizes: ['250g', '500g', '1kg', '2kg', '3kg', '5kg', '10kg', '25kg', '50kg'],
    brands: [],
    subtypes: [],
    groups: [
      {
        label: 'Flour',
        brands: ['Dola', 'Ajab', 'EXE', 'Jogoo', 'Pembe', 'Butterfly', 'Raha', 'Golda', 'Muthu', 'Türk Tarım', 'Oba'],
        subtypes: [
          'Wheat Flour (All Purpose)',
          'Wheat Flour (Whole Wheat)',
          'Wheat Flour (Atta Stone Ground)',
          'Wheat Flour (Self-Raising)',
          'Maize Meal (Sifted)',
          'Maize Meal (Unsifted)',
        ],
        sizes: ['500g', '1kg', '2kg', '5kg', '10kg', '25kg', '50kg'],
      },
      {
        label: 'Rice',
        brands: ['Daawat', 'Kilombero', 'Pishori', "Uncle Ben's", 'Tilda', 'Hamza'],
        subtypes: ['Pishori Rice', 'Long Grain Rice', 'Basmati Rice'],
        sizes: ['500g', '1kg', '2kg', '5kg', '10kg', '25kg', '50kg'],
      },
      {
        label: 'Sugar',
        brands: ['Mumias', 'Soit', 'Kabras'],
        subtypes: ['White Sugar', 'Brown Sugar'],
        sizes: ['500g', '1kg', '2kg', '3kg', '5kg', '10kg', '25kg', '50kg'],
      },
      {
        label: 'Pasta & Noodles',
        brands: ['Dola', 'Ajab', 'Pembe', 'Jogoo', 'Raha', 'Golda', 'Türk Tarım', 'Muthu'],
        subtypes: [
          'Spaghetti',
          'Macaroni Elbow (Small)',
          'Macaroni Elbow (Large)',
          'Fusilli',
          'Penne',
        ],
        sizes: ['200g', '400g', '500g', '1kg', '5kg'],
      },
      {
        label: 'Oats & Cereals',
        brands: ['Weetabix', 'Salama', 'Asanta'],
        subtypes: ['Quick Oats', 'Instant Porridge', 'Wheat Biscuit Cereal'],
        sizes: ['200g', '425g', '500g', '850g', '1kg', '2kg'],
      },
      {
        label: 'Legumes',
        brands: ['Tamu', "Farmer's Choice", 'Asanta'],
        subtypes: ['Green Gram (Ndengu)', 'Red Kidney Beans', 'Lentils', 'Black Eye Beans'],
        sizes: ['100g', '250g', '500g', '1kg', '2kg', '5kg', '10kg', '25kg', '50kg'],
      },
    ],
  },

  'Canned & Sauces': {
    brands: [
      'Hilwa', 'Zesta', 'Heinz', 'Nash', 'Faragello', 'Dana',
      'Kagzi', 'Tastic', 'Kensalt', 'Morning Fresh',
      'American Gourmet', 'Gilda', 'C.B.C.',
    ],
    subtypes: [
      'Tuna in Sunflower Oil',
      'Tuna in Brine',
      'Tomato Ketchup',
      'Chilli Sauce',
      'Tomato Puree',
      'Tomato Sauce',
      'Coconut Oil (Canned)',
      'Coconut Milk',
      'Coconut Cream',
      'Sweetened Condensed Milk',
      'White Vinegar',
      'Baked Beans in Tomato Sauce',
      'Sardines in Oil',
      'Corned Beef',
      'Food Seasoning Sauce',
    ],
    sizes: [
      '95g', '200g', '325g', '390g', '400g', '400ml',
      '500g', '570g', '700g', '700ml', '1kg', '3kg', '5kg',
      '95g (48-pack case)',
    ],
  },

  'Dairy & Spreads': {
    brands: [
      'Brookside', 'Lato', 'Lato Milk', 'Dairyland', 'Fresha', 'KCC',
      'Blue Band', 'Prestige', 'Anchor', 'Daima',
    ],
    subtypes: [
      'Full Cream Milk Powder',
      'Skimmed Milk Powder',
      'Instant Whole Milk Powder',
      'Margarine (Original)',
      'Butter (Salted)',
      'Butter (Unsalted)',
      'UHT Full Cream Milk',
      'UHT Skimmed Milk',
      'Yoghurt (Plain)',
      'Yoghurt (Flavoured)',
    ],
    sizes: ['100g', '250g', '500g', '1kg', '2kg', '2.5kg', '500ml', '1L', '2L'],
  },

  'Cooking Oils': {
    brands: [
      'Salit', 'Rinsun', 'Popco', 'Elianto', 'Golden Fry',
      'Olivita', 'C.B.C.', 'Rina', 'Kasuku', 'Soya',
    ],
    subtypes: [
      'Sunflower Oil',
      'Vegetable Oil (Fortified)',
      'Coconut Oil (Pure)',
      'Olive Oil Blend',
      'Palm Oil',
      'Soya Bean Oil',
    ],
    sizes: ['500ml', '1L', '2L', '3L', '5L', '10L', '20L'],
  },

  'Snacks & Confectionery': {
    brands: [
      'Snickers', 'Cadbury', 'KitKat', 'Ferrero', 'Nutella', 'Mars', 'Milky Way',
      'Oreo', 'Digestive', "McVitie's", 'Britannia', 'Elite',
      'Krackles', 'Lindo', 'Twist', 'Peak Freeans', 'Abu Walad',
      'Nut Gold', 'Mbichi',
    ],
    subtypes: [
      'Chocolate Bar',
      'Hazelnut / Chocolate Spread',
      'Cream Biscuit',
      'Sandwich Biscuit',
      'Plain Biscuit / Cookie',
      'Wafer',
      'Cake / Donut',
      'Potato Crisps',
      'Peanut Butter',
      'Hard Candy / Sweets',
      'Chewing Gum',
      'Nut / Mixed Nuts',
    ],
    sizes: [
      '19.9g', '30g', '40g', '45g', '50g', '90g',
      '150g', '200g', '250g', '400g',
      '24 pcs box', '40g x 24', '45g x 24', '48 pcs box',
    ],
  },

  'Hot Beverages': {
    brands: [
      'Ketepa', 'Kericho Gold', 'Kenfresh', 'Mellow Yellow',
      'Lipton', 'Mombasa Tea', 'Jambo Chai',
      'Nescafe', 'Nescafe Gold',
      'Raha', 'Nesquik', 'Milo',
    ],
    subtypes: [
      'Black Tea (Loose Leaf)',
      'Black Tea (Bags)',
      'Chai Masala Tea',
      'Instant Coffee (Classic)',
      'Instant Coffee (3-in-1)',
      'Drinking Chocolate',
      'Malted Milk Drink',
    ],
    sizes: [
      '50g', '100g', '250g', '500g', '1kg',
      '25 bags', '50 bags', '100 bags', '200 bags',
      '25g jar', '50g jar', '200g jar',
    ],
  },

  'Cold Beverages': {
    brands: [
      'Coca-Cola', 'Fanta', 'Sprite', 'Stoney', 'Krest',
      'Minute Maid', 'Delmonte', 'Afia',
      'Predator', 'Monster', 'Sting', 'Red Bull',
      'Keringet', 'Aquamist', 'Dasani',
      "Foster Clark's",
    ],
    subtypes: [
      'Cola',
      'Orange Soda',
      'Blackcurrant Soda',
      'Lemon-Lime Soda',
      'Ginger Beer',
      'Tropical Fruit Juice',
      'Orange Juice',
      'Mixed Fruit Drink',
      'Energy Drink',
      'Drinking Water',
      'Flavoured Powder Drink Mix',
    ],
    sizes: ['300ml', '350ml', '400ml', '500ml', '1L', '1.5L', '2L', '1.5L yield sachet'],
  },

  'Porridge & Baking': {
    brands: [
      'Najax', 'Najax Nutrition Food', 'Zesta', 'Uji wa Damu', 'Sawa', 'Pembe',
      'Brown & Polson', 'Rina', 'Tennessee',
    ],
    subtypes: [
      'Family Porridge Flour',
      'Uji (Millet / Sorghum)',
      'Custard Powder',
      'Baking Powder',
      'Cream of Tartar',
      'Yeast (Instant)',
      'Vanilla Essence / Flavouring',
      'Food Colouring',
    ],
    sizes: ['100g', '200g', '250g', '500g', '1kg', '1L container', '2.5kg', 'small cup'],
  },

  'Cleaning & Household': {
    brands: [
      'Rongo', 'Doffi', 'Omo', 'Ariel', 'Sunlight', 'Aerial',
      'Vim', 'Jik', 'Domestos', 'Harpic',
      'Bio Bright', 'White Wash',
      'Morning Fresh', 'Fairy',
    ],
    subtypes: [
      'Washing Powder',
      'Hand Wash Detergent Powder',
      'Dishwash Liquid',
      'Dishwash Bar',
      'Multipurpose Bar Soap',
      'Scouring Powder',
      'Bleach / Disinfectant',
      'Toilet Cleaner',
      'Window / Glass Cleaner',
      'Fabric Softener',
      'Multipurpose Household Shampoo',
    ],
    sizes: ['500g', '1kg', '2kg', '3kg', '5kg', '10kg', '500ml', '1L', '5L'],
  },

  'Toiletries & Personal Care': {
    brands: [
      'Colgate', 'Oral-B',
      'Dettol', 'Lifebuoy', 'Lux', 'Dove', 'Imperial Leather',
      'Softcare', 'Pampers', 'Huggies', 'Momeasy',
      'Head & Shoulders', 'Pantene', 'Sunsilk', 'TRESemmé', 'Lightness',
      "Johnson's", 'Amara',
      'Allday Clean', 'Roubiir', 'Taam',
      'Vaseline', 'Nivea',
    ],
    subtypes: [
      'Toothpaste',
      'Toothbrush',
      'Soap Bar (Antibacterial)',
      'Soap Bar (Moisturising)',
      'Hand Wash (Liquid)',
      'Shampoo',
      'Conditioner',
      'Hair Treatment / Mask',
      'Hair Mayonnaise',
      'Body Lotion',
      'Baby Wipes',
      'Baby Wipes (Alcohol-Free)',
      'Baby Diapers',
      'Baby Oil',
      'Baby Shampoo',
      'Petroleum Jelly / Vaseline',
    ],
    sizes: [
      '80g', '100ml', '200ml', '250ml', '400ml',
      '500ml', '750ml', '900ml', '1000g', '1kg', '1L',
      '80 pcs', '80 sheets', 'S44', 'M50', 'L52', 'XL60',
    ],
  },

  'Paper Products': {
    brands: ['Bella', 'Papernet', 'Nice', 'Kitware', 'White Swan'],
    subtypes: [
      'Tissue / Serviettes',
      'Toilet Paper',
      'Kitchen Roll / Paper Towel',
      'Paper Bags',
      'Wrapping Paper',
    ],
    sizes: [
      '100 sheets', '200 sheets',
      '2 rolls', '4 rolls', '6 rolls', '10 rolls',
      '24 packs box', '40g pack', '100 sheets / 24 x 40g packs',
    ],
  },

  'Fragrance & Air Care': {
    brands: ['Naseem', 'Glade', 'Ambi Pur', 'Air Wick', 'Rose', 'Oud Elite'],
    subtypes: [
      'Air Freshener Spray',
      'Gel Air Freshener',
      'Car Air Freshener',
      'Perfume / Cologne',
      'Attar / Oud',
      'Incense Sticks',
    ],
    sizes: ['150ml', '300ml', '400ml', '10ml', '50ml'],
  },

  'Cooking Aids': {
    brands: [
      'Jumbo', 'Royco', 'Knorr', 'Kenchic', 'Mchuzi Mix',
      'Tasty Tom', 'Safari', 'Kensalt',
      'Candid Naturals', 'Rasmi', 'Yumis',
    ],
    subtypes: [
      'Chicken Stock Cubes',
      'Beef Stock Cubes',
      'Vegetable Stock Cubes',
      'Mchuzi Mix (Beef)',
      'Mchuzi Mix (Chicken)',
      'Pilipili / Chilli Powder',
      'Paprika Powder',
      'Turmeric (Manjano)',
      'Cinnamon Powder',
      'Cumin / Jeera',
      'Coriander Powder',
      'Garlic Powder',
      'Ginger Powder',
      'Tea Masala / Chai Spice',
      'Mixed Curry Powder',
      'Food Seasoning Mix (Dehydrated)',
      'Table Salt',
      'Rock Salt',
    ],
    sizes: [
      '24 cubes', '48 cubes',
      '10g sachet', '50g', '100g', '200g', '500g', '1kg', 'jar',
    ],
  },

  'Batteries & Electronics': {
    brands: ['Eveready', 'Duracell', 'Panasonic', 'Energizer', 'Maxell', 'GP'],
    subtypes: [
      'AA Batteries (Heavy Duty)',
      'AA Batteries (Alkaline)',
      'AAA Batteries',
      'D Batteries',
      'C Batteries',
      '9V Battery',
    ],
    sizes: ['2-pack', '4-pack', '8-pack', '12-pack'],
  },
}
