import { describe, expect, it } from 'vitest';
import { businessDate, intakeCustomerIds } from '../services/intakeDate';

describe('Central Time intake totals', () => {
  it('keeps Texas evening entries on the same business day after UTC midnight', () => {
    expect(businessDate('2026-10-31T03:35:00Z')).toBe('2026-10-30');
    expect(businessDate('2026-10-31T04:59:59Z')).toBe('2026-10-30');
    expect(businessDate('2026-10-31T05:00:00Z')).toBe('2026-10-31');
  });
  it('handles winter and daylight-saving transitions', () => {
    expect(businessDate('2026-12-10T05:59:59Z')).toBe('2026-12-09');
    expect(businessDate('2026-12-10T06:00:00Z')).toBe('2026-12-10');
    expect(businessDate('2026-11-01T06:30:00Z')).toBe('2026-11-01');
    expect(businessDate('2026-11-01T07:30:00Z')).toBe('2026-11-01');
    expect(businessDate('invalid')).toBe('');
  });
  it('includes customer-only intakes and returning customers, without double counting tickets', () => {
    const customers = [
      { id: 'new', created_at: '2026-10-30T19:00:00Z' },
      { id: 'returning', created_at: '2025-01-01T12:00:00Z' },
      { id: 'old', created_at: '2026-10-29T19:00:00Z' },
    ];
    const tickets = [
      { customer_id: 'new', created_at: '2026-10-30T20:00:00Z' },
      { customer_id: 'returning', created_at: '2026-10-31T03:00:00Z' },
      { customer_id: 'returning', created_at: '2026-10-31T04:00:00Z' },
      { customer_id: 'old', created_at: '2026-10-31T05:00:00Z' },
    ];
    expect([...intakeCustomerIds(customers, tickets, '2026-10-30')]).toEqual(['new', 'returning']);
    expect(intakeCustomerIds(customers, [], '2026-10-30').size).toBe(1);
  });
});
