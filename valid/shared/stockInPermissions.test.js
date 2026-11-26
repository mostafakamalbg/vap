import assert from 'node:assert/strict';
import test from 'node:test';
import { canEditStockInDirectly } from './stockInPermissions.js';

test('super admin, MD, and Chairman can edit Stock-In directly', () => {
  for (const role of ['SuperAdmin', 'MD', 'Chairman']) {
    assert.equal(canEditStockInDirectly({ role }), true);
  }
  assert.equal(canEditStockInDirectly({ role: 'Admin' }, true), true);
});

test('general admins and logistic officers stay on the approval path', () => {
  assert.equal(canEditStockInDirectly({ role: 'Admin' }), false);
  assert.equal(canEditStockInDirectly({ role: 'General Admin' }), false);
  assert.equal(canEditStockInDirectly({ role: 'Logistic Officer' }), false);
});
