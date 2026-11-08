export type TransferStatus = "DRAFT" | "DISPATCHED" | "RECEIVING" | "COMPLETED" | "CANCELLED";
export type TransferSource = "PLANNED" | "POS_SCAN";

export interface TransferStore {
  id: string;
  name: string;
  code: string;
}

export interface TransferLine {
  id: string;
  variantId: string;
  skuCode: string;
  styleName: string;
  quantity: number;
  receivedQuantity: number;
  scannedOutAt: string | null;
  scannedInAt: string | null;
}

export interface StockTransfer {
  id: string;
  packageCode: string;
  chain: string;
  status: TransferStatus;
  source: TransferSource;
  notes: string | null;
  fromStore: TransferStore;
  toStore: TransferStore;
  createdBy: { id: string; name: string };
  packageReceivedBy: { id: string; name: string } | null;
  dispatchedAt: string | null;
  packageReceivedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  expectedPcs: number;
  receivedPcs: number;
  discrepancy: number;
  lines: TransferLine[];
}
