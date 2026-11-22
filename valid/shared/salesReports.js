const MONEY_FIELDS = [
  'lastMonthDues',
  'sales',
  'return',
  'salary',
  'collection',
  'fare',
  'l_c'
];

export function roundAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

export function validateMonthlySalesReport(report) {
  if (!String(report?.personName || '').trim()) return 'অফিসারের নাম দিন।';
  if (!String(report?.monthOfReport || '').trim()) return 'রিপোর্টের মাস দিন।';
  if (!String(report?.session || '').trim()) return 'সেশন নির্বাচন করুন।';
  const date = String(report?.reportingDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || Number.isNaN(new Date(`${date}T00:00:00.000Z`).valueOf())
    || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
    return 'সঠিক রিপোর্টিং তারিখ দিন।';
  }
  if (!Array.isArray(report.parties) || report.parties.length < 1 || report.parties.length > 500) {
    return 'কমপক্ষে ১টি এবং সর্বোচ্চ ৫০০টি পার্টির তথ্য দিন।';
  }
  for (const [index, party] of report.parties.entries()) {
    if (!String(party?.nameOfTheParty || '').trim()) {
      return `সারি ${index + 1}-এ পার্টির নাম দিন।`;
    }
    for (const field of MONEY_FIELDS) {
      const value = field === 'lastMonthDues'
        ? party.lastMonthDues
        : field === 'sales'
          ? party.presentMonth?.sales
          : field === 'return'
            ? party.presentMonth?.return
            : party.lastAndPresent?.[field];
      if (value != null && !Number.isFinite(Number(value))) {
        return `সারি ${index + 1}-এর টাকার পরিমাণ সঠিক নয়।`;
      }
    }
  }
  return '';
}

export function normalizeMonthlySalesReport(report) {
  const parties = report.parties.map((party, index) => {
    const lastMonthDues = roundAmount(party.lastMonthDues);
    const sales = roundAmount(party.presentMonth?.sales);
    const returned = roundAmount(party.presentMonth?.return);
    const netSales = sales - returned;
    const salary = roundAmount(party.lastAndPresent?.salary);
    const collection = roundAmount(party.lastAndPresent?.collection);
    const fare = roundAmount(party.lastAndPresent?.fare);
    const lc = roundAmount(party.lastAndPresent?.l_c);
    const totalCollection = salary + collection + fare + lc;
    const totalNetSales = lastMonthDues + netSales;

    return {
      slNo: roundAmount(party.slNo) || index + 1,
      nameOfTheParty: String(party.nameOfTheParty).trim(),
      lastMonthDues,
      presentMonth: { sales, return: returned, netSales },
      lastAndPresent: {
        netSales: totalNetSales,
        salary,
        collection,
        fare,
        l_c: lc
      },
      presentMonthTotalCollection: totalCollection,
      presentMonthNetDues: totalNetSales - totalCollection
    };
  });

  return {
    personName: String(report.personName).trim(),
    designation: String(report.designation || '').trim(),
    areaName: String(report.areaName || '').trim(),
    mobileNo: String(report.mobileNo || '').trim(),
    monthOfReport: String(report.monthOfReport).trim(),
    session: String(report.session).trim(),
    reportingDate: String(report.reportingDate),
    officerId: String(report.officerId || ''),
    officerCode: String(report.officerCode || ''),
    parties
  };
}
