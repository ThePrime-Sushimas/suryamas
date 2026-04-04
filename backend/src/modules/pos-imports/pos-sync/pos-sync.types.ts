export interface SaleInput {
  salesNum: string;
  billNum?: string | null;
  bookNum?: string | null;
  queueNum?: string | null;
  salesDate: string;
  salesDateIn: string;
  orderTimeOut?: string | null;
  salesDateOut?: string | null;
  branchID: string;
  memberID?: string | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  employeeType?: string | null;
  memberCode?: string | null;
  tableID: string;
  visitPurposeID: string;
  visitorTypeID?: string | null;
  paxTotal: number | string;
  subtotal: number | string;
  discountTotal: number | string;
  menuDiscountTotal: number | string;
  promotionDiscount: number | string;
  voucherDiscountTotal?: number | string | null;
  otherTaxTotal: number | string;
  vatTotal: number | string;
  otherVatTotal?: number | string | null;
  deliveryCost?: number | string | null;
  orderFee?: number | string | null;
  grandTotal: number | string;
  voucherTotal: number | string;
  roundingTotal?: number | string | null;
  paymentTotal: number | string;
  billingPrintCount: number | string;
  paymentPrintCount: number | string;
  additionalInfo?: string | null;
  remarks?: string | null;
  promotionID?: string | null;
  promotionVoucherCode?: string | null;
  flagInclusive?: boolean | null;
  lockTable?: boolean | null;
  transactionModeID?: string | null;
  deliveryTime?: string | null;
  externalMembershipTypeID?: string | null;
  flagExternalAPI?: boolean | null;
  flagExternalMemberID?: string | null;
  flagExternalMemberPhone?: string | null;
  flagExternalCardID?: string | null;
  externalMemberName?: string | null;
  externalTransID?: string | null;
  externalCancelTransID?: string | null;
  terminalID?: string | null;
  printEsoFsQr?: string | null;
  statusID: string;
  createdBy?: string | null;
  editedBy?: string | null;
  editedDate?: string | null;
  syncDate?: string | null;
}

export interface SaleItemInput {
  ID: number | string;
  localID?: number | string | null; // ✅ ADDED — missing sebelumnya
  salesNum: string;
  batchID: string;
  menuRefID: string;
  menuGroupID: string;
  menuID: string;
  customMenuName?: string | null;
  qty: number | string;
  originalPrice: number | string;
  price: number | string;
  inclusivePrice?: number | string | null;
  discount: number | string;
  discountValue?: number | string | null;
  inclusiveDiscountValue?: number | string | null;
  otherTax: number | string;
  otherTaxValue?: number | string | null;
  vat: number | string;
  vatValue?: number | string | null;
  otherVat?: number | string | null;
  otherVatValue?: number | string | null;
  otherTaxOnVat: number | string;
  total: number | string;
  notes?: string | null;
  statusID: string;
  promotionDetailID: string;
  menuPromotionID: string;
  promotionVoucherCode?: string | null;
  cancelNotes?: string | null;
  salesType?: string | null;
  flagPending?: number | string | null;
  createdBy?: string | null;
  createdDate?: string | null;
  editedBy?: string | null;
  editedDate?: string | null;
  syncDate?: string | null;
}

export interface SalePaymentInput {
  ID: number | string;
  localID?: number | string | null;
  salesNum: string;
  paymentMethodID: string;
  voucherCode: string;
  voucherCategoryID?: string | null;
  notes?: string | null;
  cardNumber: string;
  bankName: string;
  accountName: string;
  selfOrderID?: string | null;
  verificationCode: string;
  edcTerminalID?: string | null;
  traceNumber?: string | null;
  canceledVerificationCode?: string | null;
  flagExternalVoucherAPI?: boolean | null;
  externalVoucherCode?: string | null;
  externalTransactionId?: string | null;
  externalBatchNumber?: string | null;
  externalCanceledTransactionId?: string | null;
  externalCanceledBatchNumber?: string | null;
  coaNo: string;
  paymentAmount: number | string;
  fullPaymentAmount?: number | string | null;
  syncDate?: string | null;
}

export interface ImportSalesPayload {
  sales?: SaleInput[];
  items?: SaleItemInput[];
  payments?: SalePaymentInput[];
}

export interface ImportSalesResult {
  success: boolean;
  sales: number;
  items: number;
  payments: number;
}
