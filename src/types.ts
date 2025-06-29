export interface ReceiptItem {
  item: string;
  cost: number | ""; // allow empty string for UI binding
  people: string;
}
