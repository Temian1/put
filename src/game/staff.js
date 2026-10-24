// Payroll: staff are paid after each shift, from the shift's cash first and
// then from savings. Anyone not paid in full gets a strike; at UNPAID_LIMIT
// strikes in a row they quit ("retire"). A paid shift clears their strikes.
export const UNPAID_LIMIT = 3;

export const onDuty = (d, staff) =>
  staff.filter((s) => d.staff.includes(s.id) && !d.staffOff.includes(s.id));

// `cash` is everything available to pay with (savings + this shift's net).
// Staff are paid in hiring order. Returns the bill and who was left unpaid.
export function payroll(d, staff, cash) {
  const workers = onDuty(d, staff).sort(
    (a, b) => d.staff.indexOf(a.id) - d.staff.indexOf(b.id),
  );
  let left = Math.max(0, cash),
    paid = 0;
  const unpaid = [],
    quit = [];
  d.unpaid = d.unpaid || {};
  for (const s of workers) {
    if (left >= s.wage) {
      left -= s.wage;
      paid += s.wage;
      d.unpaid[s.id] = 0;
    } else {
      d.unpaid[s.id] = (d.unpaid[s.id] || 0) + 1;
      unpaid.push(s.id);
      if (d.unpaid[s.id] >= UNPAID_LIMIT) quit.push(s.id);
    }
  }
  quit.forEach((id) => removeStaff(d, id));
  return {
    bill: workers.reduce((t, s) => t + s.wage, 0),
    paid,
    unpaid,
    quit,
  };
}

// Sacking saves the salary; rehiring later costs the full hiring fee again.
export function removeStaff(d, id) {
  d.staff = d.staff.filter((x) => x !== id);
  d.staffOff = d.staffOff.filter((x) => x !== id);
  if (d.unpaid) delete d.unpaid[id];
}
