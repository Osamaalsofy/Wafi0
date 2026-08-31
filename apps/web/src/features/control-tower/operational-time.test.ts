import { describe, expect, it } from 'vitest';
import { formatOperationalTime } from './operational-time';

describe('formatOperationalTime', () => {
  it('uses the explicit operational timezone instead of the host timezone', () => {
    const formatted = formatOperationalTime('2026-08-10T05:00:00.000Z', 'Asia/Riyadh');

    expect(formatted).toContain('8:00 AM');
    expect(formatted).toMatch(/GMT\+3|AST/);
  });

  it('uses explicit UTC when no route timezone exists', () => {
    const formatted = formatOperationalTime('2026-08-10T05:00:00.000Z', null);

    expect(formatted).toContain('5:00 AM');
    expect(formatted).toMatch(/UTC|GMT/);
  });
});
