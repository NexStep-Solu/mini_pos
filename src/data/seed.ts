import type { Brand, Category, Customer, CustomerGroup, Product, Supplier, Unit } from '../types';
import { ORG_ID } from '../lib/supabase';

export const ORG = {
  id: ORG_ID,
  name: 'Shwe Mini Mart',
  slug: 'shwe-mini-mart',
  phone: '+95 9 123 456789',
  email: 'hello@shweminimart.mm',
  address: 'No. 123, Pyay Road, Kamayut Township, Yangon',
  currency: 'MMK',
  timezone: 'Asia/Yangon',
};

export const BRANCH = {
  id: 'demo-branch-001',
  organization_id: ORG_ID,
  name: 'Kamayut Main Branch',
  code: 'KM-01',
  phone: '+95 9 123 456789',
  address: 'No. 123, Pyay Road, Kamayut, Yangon',
  is_active: true,
};

export const seedUnits: Unit[] = [
  { id: 'u-pc', organization_id: ORG_ID, name: 'Piece', short_name: 'pc', allow_decimal: false },
  { id: 'u-bt', organization_id: ORG_ID, name: 'Bottle', short_name: 'btl', allow_decimal: false },
  { id: 'u-bx', organization_id: ORG_ID, name: 'Box', short_name: 'box', allow_decimal: false },
  { id: 'u-pk', organization_id: ORG_ID, name: 'Pack', short_name: 'pack', allow_decimal: false },
  { id: 'u-kg', organization_id: ORG_ID, name: 'Kilogram', short_name: 'kg', allow_decimal: true },
  { id: 'u-g', organization_id: ORG_ID, name: 'Gram', short_name: 'g', allow_decimal: true },
  { id: 'u-l', organization_id: ORG_ID, name: 'Litre', short_name: 'L', allow_decimal: true },
  { id: 'u-can', organization_id: ORG_ID, name: 'Can', short_name: 'can', allow_decimal: false },
];

export const seedCategories: Category[] = [
  { id: 'c-bev', organization_id: ORG_ID, name: 'Beverages', description: 'Soft drinks, coffee, tea, water', is_active: true },
  { id: 'c-snack', organization_id: ORG_ID, name: 'Snacks', description: 'Chips, biscuits, nuts', is_active: true },
  { id: 'c-groc', organization_id: ORG_ID, name: 'Grocery', description: 'Rice, oil, noodles, canned food', is_active: true },
  { id: 'c-dairy', organization_id: ORG_ID, name: 'Dairy & Chilled', description: 'Milk, eggs, yogurt, butter', is_active: true },
  { id: 'c-house', organization_id: ORG_ID, name: 'Household', description: 'Detergent, tissue, soap', is_active: true },
  { id: 'c-care', organization_id: ORG_ID, name: 'Personal Care', description: 'Shampoo, toothpaste, skincare', is_active: true },
  { id: 'c-froz', organization_id: ORG_ID, name: 'Frozen Food', description: 'Frozen meat, dim sum, ice cream', is_active: true },
  { id: 'c-bake', organization_id: ORG_ID, name: 'Bakery', description: 'Bread, cake, buns', is_active: true },
];

export const seedBrands: Brand[] = [
  { id: 'b-coke', organization_id: ORG_ID, name: 'Coca-Cola', is_active: true },
  { id: 'b-pepsi', organization_id: ORG_ID, name: 'Pepsi', is_active: true },
  { id: 'b-premier', organization_id: ORG_ID, name: 'Premier', is_active: true },
  { id: 'b-mamee', organization_id: ORG_ID, name: 'Mamee', is_active: true },
  { id: 'b-shwe', organization_id: ORG_ID, name: 'Shwe', is_active: true },
  { id: 'b-meiji', organization_id: ORG_ID, name: 'Meiji', is_active: true },
  { id: 'b-lifebuoy', organization_id: ORG_ID, name: 'Lifebuoy', is_active: true },
  { id: 'b-colgate', organization_id: ORG_ID, name: 'Colgate', is_active: true },
  { id: 'b-super', organization_id: ORG_ID, name: 'Super', is_active: true },
  { id: 'b-abc', organization_id: ORG_ID, name: 'ABC', is_active: true },
  { id: 'b-local', organization_id: ORG_ID, name: 'Local Fresh', is_active: true },
  { id: 'b-generic', organization_id: ORG_ID, name: 'Generic', is_active: true },
];

// [name, sku, barcode, cat, brand, unit, cost, sell, reorder, openingStock]
type Row = [string, string, string, string, string, string, number, number, number, number];
const ROWS: Row[] = [
  ['Coca-Cola 330ml Can', 'BEV-COKE-330', '8851123450011', 'c-bev', 'b-coke', 'u-can', 950, 1300, 48, 240],
  ['Coca-Cola 600ml PET', 'BEV-COKE-600', '8851123450028', 'c-bev', 'b-coke', 'u-bt', 1100, 1500, 48, 200],
  ['Pepsi 330ml Can', 'BEV-PEP-330', '8851123450035', 'c-bev', 'b-pepsi', 'u-can', 900, 1250, 48, 220],
  ['Pepsi 1.5L PET', 'BEV-PEP-1500', '8851123450042', 'c-bev', 'b-pepsi', 'u-bt', 2100, 2800, 24, 96],
  ['Super Coffee Mix 30s', 'BEV-SUP-30S', '9556001001011', 'c-bev', 'b-super', 'u-pk', 6800, 8500, 20, 120],
  ['Myanmar Coffee Mix 25s', 'BEV-MMR-25S', '9556001001028', 'c-bev', 'b-generic', 'u-pk', 5200, 6800, 20, 150],
  ['Premier Milk Tea 3-in-1', 'BEV-PRE-MT', '9556001001035', 'c-bev', 'b-premier', 'u-pk', 4500, 5900, 20, 110],
  ['ABC Orange Juice 1L', 'BEV-ABC-OJ1L', '9556001001042', 'c-bev', 'b-abc', 'u-bt', 2800, 3600, 24, 88],
  ['Bottled Water 500ml', 'BEV-WTR-500', '9556001001059', 'c-bev', 'b-generic', 'u-bt', 300, 500, 100, 600],
  ['Bottled Water 1L', 'BEV-WTR-1000', '9556001001066', 'c-bev', 'b-generic', 'u-bt', 450, 700, 100, 480],
  ['Energy Drink 250ml', 'BEV-ENG-250', '9556001001073', 'c-bev', 'b-generic', 'u-can', 1200, 1700, 36, 180],
  ['Iced Green Tea 500ml', 'BEV-GRT-500', '9556001001080', 'c-bev', 'b-generic', 'u-bt', 800, 1200, 36, 160],
  ['Potato Chips BBQ 55g', 'SNK-CHIP-BBQ', '9556002001011', 'c-snack', 'b-generic', 'u-pc', 900, 1400, 40, 200],
  ['Potato Chips Original 55g', 'SNK-CHIP-ORG', '9556002001028', 'c-snack', 'b-generic', 'u-pc', 900, 1400, 40, 190],
  ['Mamee Noodle Snack', 'SNK-MAMEE-01', '9556002001035', 'c-snack', 'b-mamee', 'u-pc', 350, 600, 100, 500],
  ['Chocolate Wafer Roll', 'SNK-WAF-CHOC', '9556002001042', 'c-snack', 'b-generic', 'u-pc', 600, 1000, 60, 300],
  ['Butter Biscuits 400g', 'SNK-BIS-400', '9556002001059', 'c-snack', 'b-generic', 'u-pk', 2200, 3000, 24, 120],
  ['Peanuts Roasted 120g', 'SNK-NUT-120', '9556002001066', 'c-snack', 'b-shwe', 'u-pk', 1300, 1900, 36, 170],
  ['Shrimp Crackers 80g', 'SNK-SHR-80', '9556002001073', 'c-snack', 'b-generic', 'u-pc', 700, 1100, 48, 210],
  ['Instant Noodles Chicken', 'GRC-NDL-CHK', '9556003001011', 'c-groc', 'b-mamee', 'u-pc', 450, 700, 100, 800],
  ['Instant Noodles Tom Yum', 'GRC-NDL-TY', '9556003001028', 'c-groc', 'b-mamee', 'u-pc', 450, 700, 100, 750],
  ['Jasmine Rice 5kg', 'GRC-RICE-5KG', '9556003001035', 'c-groc', 'b-shwe', 'u-pk', 18500, 21500, 10, 60],
  ['Jasmine Rice 1kg', 'GRC-RICE-1KG', '9556003001042', 'c-groc', 'b-shwe', 'u-pk', 3800, 4500, 20, 110],
  ['Cooking Oil 1L', 'GRC-OIL-1L', '9556003001059', 'c-groc', 'b-generic', 'u-bt', 6200, 7400, 16, 90],
  ['Cooking Oil 5L', 'GRC-OIL-5L', '9556003001066', 'c-groc', 'b-generic', 'u-bt', 29500, 33500, 6, 30],
  ['Fish Sauce 750ml', 'GRC-FSH-750', '9556003001073', 'c-groc', 'b-generic', 'u-bt', 2800, 3600, 16, 80],
  ['Soy Sauce 500ml', 'GRC-SOY-500', '9556003001080', 'c-groc', 'b-generic', 'u-bt', 1800, 2500, 16, 85],
  ['Canned Sardines 155g', 'GRC-SAR-155', '9556003001097', 'c-groc', 'b-generic', 'u-can', 1600, 2200, 36, 190],
  ['Canned Tuna 185g', 'GRC-TUN-185', '9556003001103', 'c-groc', 'b-generic', 'u-can', 3200, 4100, 24, 110],
  ['Sugar 1kg', 'GRC-SUG-1KG', '9556003001110', 'c-groc', 'b-generic', 'u-pk', 2800, 3400, 24, 130],
  ['Salt 500g', 'GRC-SALT-500', '9556003001127', 'c-groc', 'b-generic', 'u-pk', 600, 900, 36, 180],
  ['Fresh Milk 1L', 'DRY-MLK-1L', '9556004001011', 'c-dairy', 'b-meiji', 'u-bt', 3400, 4200, 20, 90],
  ['Chocolate Milk 200ml', 'DRY-MLK-CH200', '9556004001028', 'c-dairy', 'b-meiji', 'u-pc', 900, 1300, 48, 220],
  ['Yogurt Cup Strawberry', 'DRY-YOG-STR', '9556004001035', 'c-dairy', 'b-meiji', 'u-pc', 1100, 1600, 36, 150],
  ['Chicken Eggs 10pcs', 'DRY-EGG-10', '9556004001042', 'c-dairy', 'b-local', 'u-pk', 2800, 3500, 24, 120],
  ['Butter 250g', 'DRY-BTR-250', '9556004001059', 'c-dairy', 'b-meiji', 'u-pc', 5500, 6800, 12, 55],
  ['Cheese Slices 12pcs', 'DRY-CHS-12', '9556004001066', 'c-dairy', 'b-generic', 'u-pk', 4800, 6000, 12, 48],
  ['Laundry Detergent 800g', 'HSH-DET-800', '9556005001011', 'c-house', 'b-generic', 'u-pk', 4200, 5400, 16, 85],
  ['Dish Soap 500ml', 'HSH-DSH-500', '9556005001028', 'c-house', 'b-generic', 'u-bt', 2200, 3000, 20, 95],
  ['Tissue Box 200 sheets', 'HSH-TIS-200', '9556005001035', 'c-house', 'b-generic', 'u-box', 1800, 2500, 24, 130],
  ['Toilet Paper 12 rolls', 'HSH-TLT-12', '9556005001042', 'c-house', 'b-generic', 'u-pk', 6800, 8400, 12, 60],
  ['Floor Cleaner 1L', 'HSH-FLR-1L', '9556005001059', 'c-house', 'b-generic', 'u-bt', 3500, 4500, 16, 70],
  ['Lifebuoy Soap 100g', 'HSH-SOP-100', '9556005001066', 'c-house', 'b-lifebuoy', 'u-pc', 1200, 1700, 48, 250],
  ['Mop Refill Head', 'HSH-MOP-01', '9556005001073', 'c-house', 'b-generic', 'u-pc', 3800, 5000, 10, 40],
  ['Shampoo 340ml', 'CAR-SHM-340', '9556006001011', 'c-care', 'b-generic', 'u-bt', 5200, 6800, 16, 75],
  ['Conditioner 340ml', 'CAR-CND-340', '9556006001028', 'c-care', 'b-generic', 'u-bt', 5400, 7000, 16, 60],
  ['Colgate Toothpaste 150g', 'CAR-TTH-150', '9556006001035', 'c-care', 'b-colgate', 'u-pc', 3800, 4900, 24, 120],
  ['Toothbrush Soft', 'CAR-TBR-S', '9556006001042', 'c-care', 'b-colgate', 'u-pc', 900, 1500, 48, 200],
  ['Body Lotion 400ml', 'CAR-LOT-400', '9556006001059', 'c-care', 'b-generic', 'u-bt', 6800, 8600, 12, 50],
  ['Face Wash 100g', 'CAR-FW-100', '9556006001066', 'c-care', 'b-generic', 'u-pc', 4500, 5800, 16, 70],
  ['Sanitary Pads 10s', 'CAR-SNP-10', '9556006001073', 'c-care', 'b-generic', 'u-pk', 2800, 3700, 24, 110],
  ['Frozen Chicken 1kg', 'FRZ-CHK-1KG', '9556007001011', 'c-froz', 'b-local', 'u-kg', 8500, 10200, 12, 55],
  ['Frozen Prawns 500g', 'FRZ-PRW-500', '9556007001028', 'c-froz', 'b-local', 'u-pk', 12000, 14500, 10, 40],
  ['Pork Dim Sum 20pcs', 'FRZ-DIM-20', '9556007001035', 'c-froz', 'b-generic', 'u-pk', 5500, 7000, 12, 60],
  ['Ice Cream Vanilla 750ml', 'FRZ-ICE-VN', '9556007001042', 'c-froz', 'b-generic', 'u-pc', 5800, 7500, 16, 70],
  ['Frozen Mixed Veg 1kg', 'FRZ-VEG-1KG', '9556007001059', 'c-froz', 'b-generic', 'u-pk', 4800, 6100, 12, 48],
  ['White Bread Loaf', 'BAK-BRD-WHT', '9556008001011', 'c-bake', 'b-local', 'u-pc', 1200, 1800, 24, 100],
  ['Wholemeal Bread', 'BAK-BRD-WM', '9556008001028', 'c-bake', 'b-local', 'u-pc', 1500, 2200, 24, 85],
  ['Butter Cake Slice', 'BAK-CAK-BT', '9556008001035', 'c-bake', 'b-local', 'u-pc', 800, 1300, 36, 140],
  ['Chicken Curry Bun', 'BAK-BUN-CHK', '9556008001042', 'c-bake', 'b-local', 'u-pc', 900, 1400, 36, 130],
  ['Croissant Butter', 'BAK-CRS-01', '9556008001059', 'c-bake', 'b-local', 'u-pc', 1300, 2000, 24, 90],
  ['Sweet Donut', 'BAK-DNT-01', '9556008001066', 'c-bake', 'b-local', 'u-pc', 700, 1200, 36, 120],
  ['Rice Crackers 150g', 'SNK-RCK-150', '9556002001080', 'c-snack', 'b-generic', 'u-pk', 1500, 2200, 30, 140],
  ['Dried Mango 100g', 'SNK-MNG-100', '9556002001097', 'c-snack', 'b-shwe', 'u-pk', 2500, 3400, 20, 90],
  ['Instant Tea Mix 20s', 'BEV-TEA-20S', '9556001001097', 'c-bev', 'b-premier', 'u-pk', 3900, 5200, 20, 100],
  ['Condensed Milk 390g', 'GRC-CDM-390', '9556003001134', 'c-groc', 'b-generic', 'u-can', 2900, 3700, 24, 105],
  ['Evaporated Milk 400ml', 'GRC-EVM-400', '9556003001141', 'c-groc', 'b-generic', 'u-can', 2400, 3100, 24, 95],
  ['Black Beans 500g', 'GRC-BNB-500', '9556003001158', 'c-groc', 'b-shwe', 'u-pk', 3200, 4000, 20, 80],
  ['Peanut Oil 900ml', 'GRC-PNT-900', '9556003001165', 'c-groc', 'b-shwe', 'u-bt', 7800, 9200, 12, 55],
  ['Hand Sanitizer 250ml', 'CAR-SAN-250', '9556006001080', 'c-care', 'b-lifebuoy', 'u-bt', 2800, 3800, 20, 85],
  ['Detergent Bar 3pcs', 'HSH-DTB-3', '9556005001080', 'c-house', 'b-generic', 'u-pk', 1500, 2200, 30, 150],
  ['Coffee Beans 500g', 'BEV-CFB-500', '9556001001103', 'c-bev', 'b-super', 'u-pk', 9500, 12000, 10, 45],
  ['Green Peas Snack 90g', 'SNK-GRP-90', '9556002001103', 'c-snack', 'b-generic', 'u-pc', 1100, 1700, 40, 160],
  ['Egg Noodles 400g', 'GRC-EGN-400', '9556003001172', 'c-groc', 'b-mamee', 'u-pk', 1800, 2500, 24, 110],
  ['Vermicelli 500g', 'GRC-VRM-500', '9556003001189', 'c-groc', 'b-generic', 'u-pk', 1600, 2200, 24, 100],
];

export function buildSeedProducts(): Product[] {
  const now = new Date().toISOString();
  return ROWS.map((r, i) => ({
    id: `p-${String(i + 1).padStart(3, '0')}`,
    organization_id: ORG_ID,
    category_id: r[3],
    brand_id: brandFor(r[4]),
    name: r[0],
    sku: r[1],
    barcode: r[2],
    description: '',
    unit_id: r[5],
    cost_price: r[6],
    selling_price: r[7],
    wholesale_price: null,
    minimum_price: Math.round(r[7] * 0.9),
    reorder_level: r[8],
    reorder_quantity: r[8] * 2,
    track_stock: true,
    allow_negative_stock: false,
    is_active: true,
    image_url: null,
    created_at: now,
    updated_at: now,
  }));
}

function brandFor(id: string): string {
  return id;
}

export function openingStockQty(productId: string): number {
  const idx = buildSeedProducts().findIndex((p) => p.id === productId);
  if (idx < 0) return 0;
  return ROWS[idx][9];
}

export const seedSuppliers: Supplier[] = [
  { id: 's-001', organization_id: ORG_ID, name: 'City FMCG Distribution', contact_person: 'U Min Khant', phone: '+95 9 111 222333', email: 'sales@cityfmcg.mm', address: 'Bayintnaung Wholesale Market, Yangon', is_active: true, credit_limit: 5000000 },
  { id: 's-002', organization_id: ORG_ID, name: 'Shwe Nandar Foods', contact_person: 'Daw Nandar', phone: '+95 9 222 333444', email: 'order@shwenandar.mm', address: 'Mingaladon, Yangon', is_active: true, credit_limit: 3000000 },
  { id: 's-003', organization_id: ORG_ID, name: 'Fresh Daily Farm', contact_person: 'U Aung Ko', phone: '+95 9 333 444555', email: 'fresh@dailyfarm.mm', address: 'Hlegu Township, Yangon', is_active: true },
  { id: 's-004', organization_id: ORG_ID, name: 'ABC Beverage Myanmar', contact_person: 'Ko Thura', phone: '+95 9 444 555666', email: 'thura@abcbev.mm', address: 'Thilawa SEZ, Yangon', is_active: true },
  { id: 's-005', organization_id: ORG_ID, name: 'Household Essentials Co', contact_person: 'Daw Su Su', phone: '+95 9 555 666777', email: 'susu@hhess.mm', address: 'South Dagon, Yangon', is_active: true },
  { id: 's-006', organization_id: ORG_ID, name: 'CareLine Personal Care', contact_person: 'Ma May', phone: '+95 9 666 777888', email: 'may@careline.mm', address: 'Kamaryut, Yangon', is_active: true },
  { id: 's-007', organization_id: ORG_ID, name: 'Frozen Food Express', contact_person: 'U Zaw Htet', phone: '+95 9 777 888999', email: 'zaw@frozenexp.mm', address: 'Hlaing Tharyar, Yangon', is_active: true },
  { id: 's-008', organization_id: ORG_ID, name: 'Golden Bakery Supply', contact_person: 'Daw Hla Hla', phone: '+95 9 888 999000', email: 'hla@goldenbakery.mm', address: 'Sanchaung, Yangon', is_active: true },
  { id: 's-009', organization_id: ORG_ID, name: 'Rice & Oil Trading', contact_person: 'U Kyaw Swar', phone: '+95 9 999 000111', email: 'kyaw@riceoil.mm', address: 'Bayintnaung, Yangon', is_active: true },
  { id: 's-010', organization_id: ORG_ID, name: 'Mamee Myanmar Agent', contact_person: 'Ko Pyae', phone: '+95 9 000 111222', email: 'pyae@mamee.mm', address: 'Bahan, Yangon', is_active: true },
];

export const seedGroups: CustomerGroup[] = [
  { id: 'g-walkin', organization_id: ORG_ID, name: 'Walk-in', discount_pct: 0 },
  { id: 'g-reg', organization_id: ORG_ID, name: 'Regular', discount_pct: 2 },
  { id: 'g-vip', organization_id: ORG_ID, name: 'VIP', discount_pct: 5 },
  { id: 'g-whole', organization_id: ORG_ID, name: 'Wholesale', discount_pct: 7 },
  { id: 'g-staff', organization_id: ORG_ID, name: 'Staff', discount_pct: 10 },
];

const FIRST = ['Aung', 'Min', 'Thura', 'Kyaw', 'Zaw', 'Pyae', 'Htet', 'Su', 'May', 'Nandar', 'Hla', 'Mya', 'Soe', 'Wai', 'Chit', 'Ei', 'Khin', 'Yamin', 'Phyo', 'Sandar'];
const LAST = ['Khant', 'Aung', 'Htet', 'Moe', 'Lin', 'Thiri', 'Myat', 'Oo', 'Naing', 'Win', 'Tun', 'Phyu', 'Sandar', 'Zaw', 'Khaing'];

export function buildSeedCustomers(): Customer[] {
  const now = new Date().toISOString();
  const list: Customer[] = [
    { id: 'cu-walkin', organization_id: ORG_ID, customer_code: 'C-0000', name: 'Walk-in Customer', phone: '-', is_active: true, credit_limit: 0, current_balance: 0, loyalty_points: 0, group_id: 'g-walkin', created_at: now, updated_at: now },
  ];
  for (let i = 1; i <= 100; i++) {
    const fn = FIRST[i % FIRST.length];
    const ln = LAST[(i * 7) % LAST.length];
    const groups = ['g-reg', 'g-reg', 'g-reg', 'g-vip', 'g-whole', 'g-staff'];
    list.push({
      id: `cu-${String(i).padStart(3, '0')}`,
      organization_id: ORG_ID,
      customer_code: `C-${String(i).padStart(4, '0')}`,
      name: `${fn} ${ln}`,
      phone: `+95 9 ${String(200000000 + i * 137913).slice(0, 9)}`,
      address: `Yangon`,
      group_id: groups[i % groups.length],
      credit_limit: i % 10 === 0 ? 200000 : 50000,
      current_balance: 0,
      loyalty_points: Math.floor(Math.random() * 800),
      is_active: true,
      created_at: now,
      updated_at: now,
    });
  }
  return list;
}
