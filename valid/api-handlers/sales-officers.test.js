import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOfficerPeriodFilters } from './sales-officers.js';

test('officer summaries apply ISO month and date filters to typed and legacy records', () => {
  const { filters, legacyFilters } = buildOfficerPeriodFilters('2026-03', '2026-03-14');

  assert.deepEqual(filters, [
    { date: { $gte: '2026-03-01', $lt: '2026-04-01' } },
    { date: '2026-03-14' }
  ]);
  assert.deepEqual(legacyFilters, [
    { 'data.date': { $gte: '2026-03-01', $lt: '2026-04-01' } },
    { 'data.date': '2026-03-14' }
  ]);
});

test('officer summaries do not narrow all-time or non-ISO month filters in the database', () => {
  assert.deepEqual(buildOfficerPeriodFilters('ALL', 'ALL'), {
    filters: [],
    legacyFilters: []
  });
  assert.deepEqual(buildOfficerPeriodFilters('March 2026', 'ALL'), {
    filters: [],
    legacyFilters: []
  });
});
