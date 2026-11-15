export function buildStockLedger(events, startDate, endDate, currentBalance) {
  if (!startDate || !endDate || startDate > endDate) {
    return { openingBalance: 0, rows: [] };
  }

  const datedEvents = events
    .map((event, index) => ({ ...event, index }))
    .filter((event) => (
      /^\d{4}-\d{2}-\d{2}$/.test(event.date)
      && Number.isFinite(event.changeCartons)
    ))
    .sort((left, right) => left.date.localeCompare(right.date) || left.index - right.index);
  const openingBalance = Number(currentBalance || 0) - datedEvents
    .filter((event) => event.date >= startDate)
    .reduce((total, event) => total + event.changeCartons, 0);
  let runningTotal = openingBalance;
  const rows = datedEvents
    .filter((event) => event.date >= startDate && event.date <= endDate)
    .map(({ index, ...event }) => {
      runningTotal += event.changeCartons;
      return { ...event, runningTotal };
    });

  return { openingBalance, rows };
}
