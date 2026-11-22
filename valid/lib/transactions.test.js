import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { withTransactionFallback } from './transactions.js';

test('transaction fallback retries without a session on unsupported sharded transaction errors', async () => {
  const originalStartSession = mongoose.startSession;
  let sessionEnded = false;
  mongoose.startSession = async () => ({
    withTransaction: async () => {
      throw new Error('Only servers in a sharded cluster can start a new transaction at the active transaction number');
    },
    endSession: async () => {
      sessionEnded = true;
    }
  });

  const receivedSessions = [];
  try {
    await withTransactionFallback(async (session) => {
      receivedSessions.push(session);
    });
  } finally {
    mongoose.startSession = originalStartSession;
  }

  assert.deepEqual(receivedSessions, [null]);
  assert.equal(sessionEnded, true);
});
