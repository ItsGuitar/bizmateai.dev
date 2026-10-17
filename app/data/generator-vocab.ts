// Vocabulary bank for the Mock Document & Chaos Data Generator (/dashboard/generator). Pure
// data, no logic: lib/document-generator.ts samples from these arrays to assemble a document.
// Only lib/document-generator.ts should import this file.

export interface BilingualEntity {
  id: string;
  nameEn: string;
  nameLocal: string; // Chinese or Thai script
  country: "CN" | "TH";
  role: "manufacturer" | "buyer" | "supplier" | "industrial_buyer";
}

export interface LineItemVocab {
  id: string;
  descriptionEn: string;
  descriptionTh: string;
  descriptionZh: string;
  unit: string; // kg, MT, pcs, m
}

export type IdentifierKind =
  | "invoice_no"
  | "po_no"
  | "tax_id"
  | "receipt_no"
  | "delivery_no"
  | "bl_no"
  | "hs_code"
  | "guarantee_tag";

export interface IdentifierFormat {
  id: string;
  kind: IdentifierKind;
  country: string;
  label: string; // e.g. "China Special VAT Invoice Code"
  // Template tokens substituted by lib/document-generator.ts: {YYYY} {MM} {DD} {D<n>} digits {A<n>} letters
  pattern: string;
  example: string;
}

export interface PaymentTermVocab {
  id: string;
  label: string;
  dateFormatHint?: "iso" | "cn_ymd" | "th_be" | "dmy";
}

export interface ChaosNotationVocab {
  id: string;
  kind: "currency" | "unit" | "negative_notation" | "mixed_unit";
  example: string;
}

export const CHINA_ENTITIES: BilingualEntity[] = [
  { id: "cn-1", nameEn: "Shenzhen Chen Precision Manufacturing Co., Ltd.", nameLocal: "深圳市陈氏精工智造有限公司", country: "CN", role: "manufacturer" },
  { id: "cn-2", nameEn: "Dongguan Huawei Auto Parts Stamping Works", nameLocal: "东莞市华威汽车零部件冲压厂", country: "CN", role: "manufacturer" },
  { id: "cn-3", nameEn: "Kunshan Longtai Electronic Hardware Industries", nameLocal: "昆山龙泰电子五金实业有限公司", country: "CN", role: "manufacturer" },
  { id: "cn-4", nameEn: "CATL Regional Supply Tier-2 Metal Fabricator", nameLocal: "宁德新能源电池结构件配套厂", country: "CN", role: "supplier" },
  { id: "cn-5", nameEn: "Foshan Nanhai Juli Extrusion Co., Ltd.", nameLocal: "佛山市南海区巨力型材挤压厂", country: "CN", role: "supplier" },
  { id: "cn-6", nameEn: "Suzhou Mingda Industrial Mold Technology Co., Ltd.", nameLocal: "苏州明达工业模具有限公司", country: "CN", role: "manufacturer" },
  { id: "cn-7", nameEn: "GAC Tier-2 Component Partner Co., Ltd.", nameLocal: "广州广汽零部件二级供应链有限公司", country: "CN", role: "buyer" },
  { id: "cn-8", nameEn: "Ningbo Haishu Lean Pneumatic Components", nameLocal: "宁波海曙精益气动元件有限公司", country: "CN", role: "supplier" },
  { id: "cn-9", nameEn: "Wuxi Hengli Seamless Tube Processing Plant", nameLocal: "无锡恒力无缝钢管加工厂", country: "CN", role: "supplier" },
  { id: "cn-10", nameEn: "Shenzhen Baoan Chuangda Plastic Molding", nameLocal: "深圳市宝安区创达精密注塑实业", country: "CN", role: "manufacturer" },
];

export const THAILAND_ENTITIES: BilingualEntity[] = [
  { id: "th-1", nameEn: "Siam Pattana Polymer Engineering Co., Ltd.", nameLocal: "บริษัท สยามพัฒนาโพลีเมอร์ เอ็นจิเนียริ่ง จำกัด", country: "TH", role: "industrial_buyer" },
  { id: "th-2", nameEn: "Rayong Automotive Metal Sheet Works", nameLocal: "บจก. ระยอง ออโตโมทีฟ เมทัลชีท เวิร์คส์", country: "TH", role: "manufacturer" },
  { id: "th-3", nameEn: "Samut Prakan Diecasting & Stamping", nameLocal: "บริษัท สมุทรปราการ ดายแคสติ้ง แอนด์ สแตมปิ้ง จำกัด", country: "TH", role: "manufacturer" },
  { id: "th-4", nameEn: "Ploy Select & Trading Co., Ltd.", nameLocal: "บจก. พลอย ซีเล็คท์ แอนด์ เทรดดิ้ง", country: "TH", role: "buyer" },
  { id: "th-5", nameEn: "Thai-Japan Precision Tools & Die", nameLocal: "บริษัท ไทย-เจแปน เพรซิชั่น ทูลส์ แอนด์ ดาย จำกัด", country: "TH", role: "manufacturer" },
  { id: "th-6", nameEn: "Siam Chonburi Supply Chain Partners", nameLocal: "บจก. สยาม ชลบุรี ซัพพลายเชน พาร์ทเนอร์ส", country: "TH", role: "industrial_buyer" },
  { id: "th-7", nameEn: "Bangpoo Industrial Electroplating LP", nameLocal: "ห้างหุ้นส่วนจำกัด บางปู ชุบเคลือบผิวโลหะอุตสาหกรรม", country: "TH", role: "supplier" },
  { id: "th-8", nameEn: "Amata Nakorn Machinery Parts Co., Ltd.", nameLocal: "บริษัท อมตะนคร แมชชีนเนอรี่ พาร์ทส์ จำกัด", country: "TH", role: "manufacturer" },
  { id: "th-9", nameEn: "Rungreang Logistics & Warehousing", nameLocal: "บจก. รุ่งเรือง โลจิสติกส์ แอนด์ แวร์เฮ้าส์ซิ่ง", country: "TH", role: "industrial_buyer" },
  { id: "th-10", nameEn: "Green EV Assembly Thailand Co., Ltd.", nameLocal: "บริษัท กรีน อีวี แอสเซมบลี ไทยแลนด์ จำกัด", country: "TH", role: "industrial_buyer" },
];

export const LINE_ITEMS: LineItemVocab[] = [
  { id: "mat-1", descriptionEn: "Cold-Rolled Steel Coils SPCC 1.2mm", descriptionTh: "เหล็กม้วนรีดเย็น SPCC", descriptionZh: "冷轧钢卷", unit: "MT" },
  { id: "mat-2", descriptionEn: "Hot-Dip Galvanized Steel Sheet SGCC", descriptionTh: "เหล็กแผ่นชุบสังกะสีกันสนิม", descriptionZh: "热镀锌钢板", unit: "MT" },
  { id: "mat-3", descriptionEn: "Industrial Extrusion Aluminum Ingot 6063-T5", descriptionTh: "อลูมิเนียมอินกอต 6063", descriptionZh: "工业铝锭", unit: "kg" },
  { id: "mat-4", descriptionEn: "Polypropylene Virgin Polymer Granules PP-H", descriptionTh: "เม็ดพลาสติกโพลีโพรพีลีน", descriptionZh: "聚丙烯原料", unit: "kg" },
  { id: "mat-5", descriptionEn: "Flame-Retardant Engineering Resin ABS-V0", descriptionTh: "เรซินพลาสติกวิศวกรรม ABS", descriptionZh: "阻燃ABS塑料粒子", unit: "kg" },
  { id: "mat-6", descriptionEn: "High-Conductivity Electrolytic Copper Rod 8mm", descriptionTh: "ลวดทองแดงนำไฟฟ้า", descriptionZh: "高纯电解铜杆", unit: "kg" },
  { id: "mat-7", descriptionEn: "Stainless Steel SUS304 Precision Slit Strips", descriptionTh: "แถบสแตนเลสรีดเรียบ SUS304", descriptionZh: "不锈钢精密带钢", unit: "kg" },
  { id: "mat-8", descriptionEn: "CNC Machined Aluminum Enclosure Heat-Sink", descriptionTh: "โครงกล่องระบายความร้อนอลูมิเนียม", descriptionZh: "散热器铝外壳", unit: "pcs" },
  { id: "mat-9", descriptionEn: "EPDM Industrial Weatherstrip Sealing Gasket", descriptionTh: "ซีลยางเอทิลีนโพรพีลีนไดอีน", descriptionZh: "三元乙丙橡胶密封圈", unit: "m" },
  { id: "mat-10", descriptionEn: "High-Tensile Fasteners Grade 8.8 M6x25", descriptionTh: "สลักเกลียวทนแรงดึงสูง", descriptionZh: "8.8级高强度螺栓", unit: "pcs" },
];

export const IDENTIFIER_FORMATS: IdentifierFormat[] = [
  { id: "id-1", kind: "tax_id", country: "CN", label: "China Special VAT Invoice Code", pattern: "{D12}", example: "044032600111" },
  { id: "id-2", kind: "tax_id", country: "CN", label: "Unified Social Credit Code (USCC)", pattern: "9144{D2}00MA5{A3}{D4}", example: "91440300MA5DEF1234" },
  { id: "id-3", kind: "tax_id", country: "TH", label: "Thai Corporate Tax ID (13 digit)", pattern: "{D13}", example: "0105559123456" },
  { id: "id-4", kind: "po_no", country: "CN", label: "Shenzhen PO Serial", pattern: "PO-SZ-{YYYY}-{D5}-X", example: "PO-SZ-2026-89412-X" },
  { id: "id-5", kind: "invoice_no", country: "TH", label: "Thai Tax Invoice Number", pattern: "TAX-INV-BKK/{YYYY}/{MM}-{D4}", example: "TAX-INV-BKK/2026/10-0982" },
  { id: "id-6", kind: "receipt_no", country: "CN", label: "e-IOU Commercial Acceptance Bill Number", pattern: "{D29}", example: "23057110001220261017894561230" },
  { id: "id-7", kind: "delivery_no", country: "TH", label: "Delivery Challan", pattern: "DO-{YYYY}-RAY-{D4}", example: "DO-2026-RAY-0045" },
  { id: "id-8", kind: "bl_no", country: "CN", label: "Bill of Lading (B/L)", pattern: "COSCO-SHENZHEN-LC-{D5}", example: "COSCO-SHENZHEN-LC-99021" },
  { id: "id-9", kind: "hs_code", country: "CN", label: "HS Code, flat-rolled iron/non-alloy steel", pattern: "{D4}.{D2}.{D2}", example: "7209.16.00" },
  { id: "id-10", kind: "guarantee_tag", country: "TH", label: "TCG Reference Guarantee Tag", pattern: "TCG-QBW-{YYYY}-{A1}{D2}{A1}", example: "TCG-QBW-2026-B50B" },
];

export const PAYMENT_TERMS: PaymentTermVocab[] = [
  { id: "term-1", label: "Net 30 Days from B/L Date (เครดิตเทอม 30 วัน / 提单日后30天付款)" },
  { id: "term-2", label: "Net 60 Days Open Account (เครดิตเทอม 60 วัน / 月结60天)" },
  { id: "term-3", label: "Net 90 Days Supplier Export Financing (เครดิต 90 วัน / 90天商业承兑)" },
  { id: "term-4", label: "Due on Maturity", dateFormatHint: "iso" },
  { id: "term-5", label: "开票日期 / Invoice issue date", dateFormatHint: "cn_ymd" },
  { id: "term-6", label: "วันที่ครบกำหนดชำระ / Due date", dateFormatHint: "th_be" },
  { id: "term-7", label: "Commercial Terms: DDP Factory Warehouse (Chonburi, Thailand)" },
  { id: "term-8", label: "Commercial Terms: FOB Shenzhen Port (Yantian Terminal, China)" },
  { id: "term-9", label: "Discount Clause: 2% 10, Net 30 (จ่ายใน 10 วันลด 2% / 10天内付款享2%折扣)" },
  { id: "term-10", label: "Penalty Clause: Overdue interest 0.05% per day (ค่าปรับล่าช้า 0.05% ต่อวัน / 逾期每日加收0.05%违约金)" },
];

export const CHAOS_NOTATIONS: ChaosNotationVocab[] = [
  { id: "chaos-1", kind: "currency", example: "¥1,284,500.00" },
  { id: "chaos-2", kind: "currency", example: "฿4,850,000.-" },
  { id: "chaos-3", kind: "unit", example: "48.5万" },
  { id: "chaos-4", kind: "negative_notation", example: "(¥120,000.00)" },
  { id: "chaos-5", kind: "mixed_unit", example: "15.75 MT / 15,750 kg" },
];
