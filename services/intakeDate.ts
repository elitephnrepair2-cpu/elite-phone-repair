const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function businessDate(value: string | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : businessDateFormatter.format(date);
}

/** Count each customer once, including returning customers with a new ticket. */
export function intakeCustomerIds(
  customers: { id: string; created_at: string }[],
  tickets: { customer_id: string; created_at: string }[],
  date: string,
): Set<string> {
  const ids = new Set(customers.filter(c => businessDate(c.created_at) === date).map(c => c.id));
  for (const ticket of tickets) {
    if (businessDate(ticket.created_at) === date) ids.add(ticket.customer_id);
  }
  return ids;
}
