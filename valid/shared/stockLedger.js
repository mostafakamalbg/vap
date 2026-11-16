export function buildStockLedger(events, startDate, endDate, currentBalance) {
  if (!startDate || !endDate || startDate > endDate) {
    return { openingBalance: 0, rows: [] };
  }

  const datedEvents = events
    .map((event, index) => ({ ...event, index }))
    .filter((event) => (
      /^\d{4}-\d{2}-\d{2}$/.test(event.date)
      && event.unit !== 'পিস'
      && Number.isFinite(event.changeCount)
    ))
    .sort((left, right) => left.date.localeCompare(right.date) || left.index - right.index);
  const openingBalance = (Number(currentBalance) || 0) - datedEvents
    .filter((event) => event.date >= startDate)
    .reduce((total, event) => total + event.changeCount, 0);
  let runningBalance = openingBalance;
  const rows = datedEvents
    .filter((event) => event.date >= startDate && event.date <= endDate)
    .map(({ index, ...event }) => {
      runningBalance += event.changeCount;
      return { ...event, runningTotal: runningBalance };
    });

  return { openingBalance, rows };
}

export function buildDailyStockLedger(rows, openingBalance) {
  const totalsByDate = new Map();
  rows.filter((event) => event.unit !== 'পিস').forEach((event) => {
    const day = totalsByDate.get(event.date) || {
      date: event.date,
      factoryIn: 0,
      stockOut: 0,
      dealerReturns: 0,
      netChange: 0
    };
    if (event.category === 'factoryIn') day.factoryIn += Math.max(0, event.changeCount);
    else if (event.category === 'dealerReturn') day.dealerReturns += Math.max(0, event.changeCount);
    else day.stockOut += Math.max(0, -event.changeCount);
    day.netChange += event.changeCount;
    totalsByDate.set(event.date, day);
  });

  let runningBalance = openingBalance;
  return [...totalsByDate.values()]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map(({ netChange, ...day }) => {
      runningBalance += netChange;
      return { ...day, runningTotal: runningBalance };
    });
}
