export interface SaleInput {
    salesNum: string;
    billNum: string;
    bookNum: string;
    queueNum: string;
    salesDate: string;
    salesDateIn: string;
    orderTimeOut: string;
    salesDateOut: string;
    branchID: string;
    memberID: string;
    employeeCode: string;
    employeeName: string;
    employeeType: string;
    memberCode: string;
    tableID: string;
    visitPurposeID: string;
    visitorTypeID: string;
    paxTotal: number | string;
    subtotal: number | string;
    discountTotal: number | string;
    menuDiscountTotal: number | string;
    promotionDiscount: number | string;
    voucherDiscountTotal: number | string;
    otherTaxTotal: number | string;
    vatTotal: number | string;
    otherVatTotal: number | string;
    deliveryCost: number | string;
    orderFee: number | string;
    grandTotal: number | string;
    voucherTotal: number | string;
    roundingTotal: number | string;
    paymentTotal: number | string;
    billingPrintCount: number | string;
    paymentPrintCount: number | string;
    additionalInfo: string;
    remarks: string;
    promotionID: string;
    promotionVoucherCode: string;
    flagInclusive: boolean;
    lockTable: boolean;
    transactionModeID: string;
    deliveryTime: string;
    externalMembershipTypeID: string;
    flagExternalAPI: boolean;
    flagExternalMemberID: string;
    flagExternalMemberPhone: string;
    flagExternalCardID: string;
    externalMemberName: string;
    externalTransID: string;
    externalCancelTransID: string;
    terminalID: string;
    printEsoFsQr: string;
    statusID: string;
    createdBy: string;
    editedBy: string;
    editedDate: string;
    syncDate: string;
  }
  
  export interface SaleItemInput {
    ID: number | string;
    salesNum: string;
    batchID: string;
    menuRefID: string;
    menuGroupID: string;
    menuID: string;
    customMenuName: string;
    qty: number | string;
    originalPrice: number | string;
    price: number | string;
    inclusivePrice: number | string;
    discount: number | string;
    discountValue: number | string;
    inclusiveDiscountValue: number | string;
    otherTax: number | string;
    otherTaxValue: number | string;
    vat: number | string;
    vatValue: number | string;
    otherVat: number | string;
    otherVatValue: number | string;
    otherTaxOnVat: number | string;
    total: number | string;
    notes: string;
    statusID: string;
    promotionDetailID: string;
    menuPromotionID: string;
    promotionVoucherCode: string;
    cancelNotes: string;
    salesType: string;
    flagPending: boolean;
    createdBy: string;
    createdDate: string;
    editedBy: string;
    editedDate: string;
    syncDate: string;
  }
  
  export interface SalePaymentInput {
    ID: number | string;
    salesNum: string;
    localID: string;
    paymentMethodID: string;
    voucherCode: string;
    voucherCategoryID: string;
    notes: string;
    cardNumber: string;
    bankName: string;
    accountName: string;
    selfOrderID: string;
    verificationCode: string;
    edcTerminalID: string;
    traceNumber: string;
    canceledVerificationCode: string;
    flagExternalVoucherAPI: boolean;
    externalVoucherCode: string;
    externalTransactionId: string;
    externalBatchNumber: string;
    externalCanceledTransactionId: string;
    externalCanceledBatchNumber: string;
    coaNo: string;
    paymentAmount: number | string;
    fullPaymentAmount: number | string;
    syncDate: string;
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
  
  