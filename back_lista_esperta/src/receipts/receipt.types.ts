import type { StoreAddress } from '../stores/store.types.js';

/** One line of a receipt, as printed. */
export interface ReceiptLine {
  description: string;
  /** Product code printed on the receipt; a barcode only when it passes the GS1 check. */
  code: string | null;
  quantity: number;
  /** "UN", "KG", "L"… as printed. */
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

/** What we read from a receipt (SEFAZ page or photo), before matching products. */
export interface ParsedReceipt {
  accessKey: string;
  issuer: {
    name: string;
    cnpj: string;
    address: StoreAddress;
    addressText: string;
  };
  issuedAt: Date;
  total: number;
  lines: ReceiptLine[];
  source: 'SEFAZ' | 'PHOTO';
}
