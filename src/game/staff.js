// Payroll rule shared by every restaurant's crew (see crew.js): staff are paid
// after each shift, from the shift's cash first and then from savings. Anyone
// not paid in full gets a strike; at UNPAID_LIMIT strikes in a row they quit.
// A paid shift clears their strikes.
export const UNPAID_LIMIT = 3;
