import assert from 'node:assert/strict';
import test from 'node:test';
import { getOfficerCodeAliases } from './codes.js';

test('officer code aliases cover legacy FSO and separator variants', () => {
  assert.deepEqual(getOfficerCodeAliases('SO-01'), [
    'SO-01',
    'SO01',
    'FSO-01',
    'FSO01'
  ]);
  assert.deepEqual(getOfficerCodeAliases('so1'), [
    'SO1',
    'SO-01',
    'SO01',
    'FSO-01',
    'FSO01'
  ]);
});
