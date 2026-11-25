import assert from 'node:assert/strict';
import test from 'node:test';
import { getUniqueDealerCodeAliases } from './dealer-ledger.js';

test('dealer ledger uses only unique aliases belonging to the authenticated dealer', () => {
  const dealer = { id: 'dealer-1', code: 'DL-01' };
  const user = { dealerCode: 'DLR-1' };
  const dealers = [
    { id: 'dealer-1', code: 'DL-01' },
    { id: 'dealer-2', code: '2' }
  ];

  assert.deepEqual(getUniqueDealerCodeAliases(dealer, user, dealers), ['DL-01', 'DLR-1']);
});

test('dealer ledger omits duplicated code aliases to avoid cross-dealer records', () => {
  const dealer = { id: 'dealer-1', code: 'DL-01' };
  const user = { dealerCode: 'DLR-1' };
  const dealers = [
    { id: 'dealer-1', code: 'DL-01' },
    { id: 'dealer-2', code: '1' }
  ];

  assert.deepEqual(getUniqueDealerCodeAliases(dealer, user, dealers), []);
});
