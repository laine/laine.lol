/** Data for the share dialog when creating a paste with edit key */
export interface ShareDialogData {
  /** The view-only URL (encryption key only) */
  viewOnlyUrl: string;
  /** The editable URL (encryption key + edit key) */
  editableUrl: string;
  /** Whether the paste will burn after first read */
  burnAfterRead?: boolean;
  /** How many minutes until the paste expires */
  expiresInMinutes?: number | null;
  /** Whether quantum-resistant encryption was used */
  quantumResistant?: boolean;
}
