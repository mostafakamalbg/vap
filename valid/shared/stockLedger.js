export function buildStockLedger(events, startDate, endDate, currentBalance) {
  if (!startDate || !endDate || startDate > endDate) {
    return { openingBalance: 0, rows: [] };
  }

  const datedEvents = events
    .map((event, index) => ({ ...event, changeCount: Math.trunc(event.changeCount), index }))
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
    const changeCount = Math.trunc(Number(event.changeCount));
    if (!Number.isFinite(changeCount)) return;
    const day = totalsByDate.get(event.date) || {
      date: event.date,
      factoryIn: 0,
      marketReturns: 0,
      factoryReturns: 0,
      sales: 0,
      netChange: 0
    };
    if (event.category === 'factoryIn') day.factoryIn += Math.max(0, changeCount);
    else if (event.category === 'marketReturn') day.marketReturns += Math.max(0, changeCount);
    else if (event.category === 'factoryReturn') day.factoryReturns += Math.max(0, -changeCount);
    else day.sales += Math.max(0, -changeCount);
    day.netChange += changeCount;
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
