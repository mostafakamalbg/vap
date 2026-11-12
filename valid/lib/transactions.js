import mongoose from 'mongoose';

function doesNotSupportTransactions(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 20
    || message.includes('transaction numbers are only allowed')
    || message.includes('transactions are not supported');
}

export async function withTransactionFallback(operation) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(() => operation(session));
  } catch (error) {
    if (!doesNotSupportTransactions(error)) throw error;
    await operation(null);
  } finally {
    await session.endSession();
  }
}

export function transactionOptions(session) {
  return session ? { session } : {};
}
