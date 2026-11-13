import React from 'react';
import { toBn, toBnDate } from '../../utils/bengali';
import { formatDealerCode, formatInvoiceNumber, formatOfficerCode } from '../../../shared/codes';
import { normalizePaymentMethod, PAYMENT_METHODS } from '../../../shared/paymentMethods';
import { LEGACY_INVOICE_SESSION } from '../../../shared/sessions';
import { getPackageQuantityUnit } from '../../../shared/quantityUnits';
import { getInvoiceSalesAmount } from '../../../shared/invoiceTotals';
import { useAgro } from '../../context/AgroContext';
import CompanyLetterhead from './CompanyLetterhead';

const money = (value) => {
  const amount = Number(value) || 0;
  return `৳${amount.toLocaleString('bn-BD', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 1,
    maximumFractionDigits: 2
  })}`;
};

function getItemValues(item) {
  const cartons = Number(item.cartons ?? item.quantity) || 0;
  const tradePrice = Number(item.total) || cartons * (Number(item.cartonPrice) || 0);
  const commission = tradePrice * (Number(item.commission) || 0) / 100;
  return {
    cartons,
    quantityUnit: getPackageQuantityUnit(item),
    unitTradePrice: Number(item.cartonPrice) || Number(item.unitPrice) * (Number(item.packPerBox) || 1),
    tradePrice,
    commissionPercent: Number(item.commission) || 0,
    commission,
    net: tradePrice - commission
  };
}

function getReturnValues(item) {
  const quantity = Number(item.quantity ?? item.quantityPieces) || 0;
  const packPerBox = Number(item.packPerBox) || 1;
  const price = Number(item.price ?? item.unitPrice) || 0;
  return {
    quantity,
    cartons: Math.floor(quantity / packPerBox),
    loosePieces: quantity % packPerBox,
    price,
    total: Number(item.total) || quantity * price
  };
}

function getProductDescription(item) {
  const size = String(item.size || '').trim();
  const packPerBox = Number(item.packPerBox) || 1;
  const packageSize = size && packPerBox > 1 && !/[×x]/i.test(size)
    ? `${size} × ${toBn(packPerBox)}`
    : size;
  return `${item.productName || 'পণ্য'}${packageSize ? ` (${packageSize})` : ''}`;
}

export default function InvoicePrintHeader({ invoice }) {
  const { dealers } = useAgro();
  if (!invoice) return null;

  const invoiceDealerCode = formatDealerCode(invoice.dealerCode || invoice.dealerId);
  const dealer = dealers.find((entry) => (
    entry.id === invoice.dealerId
    || formatDealerCode(entry.code || entry.id) === invoiceDealerCode
  ));
  const items = invoice.items || [];
  const returns = invoice.returnAdjustments || [];
  const itemTotals = items.reduce((totals, item) => {
    const values = getItemValues(item);
    totals.cartons += values.cartons;
    totals.tradePrice += values.tradePrice;
    totals.commission += values.commission;
    totals.net += values.net;
    return totals;
  }, { cartons: 0, tradePrice: 0, commission: 0, net: 0 });
  const returnTotal = returns.reduce((sum, item) => sum + getReturnValues(item).total, 0)
    || Number(invoice.returnAdjustmentTotal) || 0;
  const transportCost = Number(invoice.transportCost) || 0;
  const invoiceNet = getInvoiceSalesAmount(invoice)
    || itemTotals.net + transportCost - returnTotal;
  const previousDue = Number(invoice.previousDue) || 0;
  const paidAmount = Number(invoice.paidAmount) || 0;
  const storedDue = invoice.currentDue ?? invoice.dueAmount;
  const currentDue = storedDue == null
    ? Math.max(0, invoiceNet + previousDue - paidAmount)
    : Number(storedDue) || 0;
  const paymentMethod = PAYMENT_METHODS.find(
    (method) => method.value === normalizePaymentMethod(invoice.paymentMethod)
  )?.label || PAYMENT_METHODS[0].label;
  const defaultComment = 'চালানের পণ্য সঠিক পরিমাণে বুঝে দেওয়া হলো।';
  const defaultNote = 'বিক্রিত পণ্য ডিলার কর্তৃক সঠিকভাবে বুঝে নেওয়া হলো।';

  return (
    <article className="invoice-print-sheet mx-auto w-full max-w-4xl bg-white p-4 text-slate-900 sm:p-8">
      <header className="invoice-company-header">
        <CompanyLetterhead className="invoice-print-letterhead" />
        <div className="invoice-session-badge">সেশন: {invoice.session || LEGACY_INVOICE_SESSION}</div>
        <h2 className="invoice-title-bar">{invoice.invoiceType === 'factory_damage' ? 'ক্ষতিগ্রস্ত পণ্য ফেরত বিবরণী' : 'ডিলার ইনভয়েস কপি'}</h2>
      </header>

      <section className="invoice-parties-grid">
        <div className="invoice-party">
          <h2>ডিলার তথ্য</h2>
          <p><strong>ডিলার কোড:</strong> {toBn(formatDealerCode(invoice.dealerCode || invoice.dealerId || '—'))}</p>
          <p><strong>প্রতিষ্ঠান:</strong> {invoice.dealerName || dealer?.shopName || '—'}</p>
          <p><strong>প্রোপাইটর:</strong> {invoice.dealerProprietor || dealer?.proprietor || '—'}</p>
          <p><strong>ঠিকানা:</strong> {invoice.dealerAddress || dealer?.address || dealer?.businessAddress || '—'}</p>
          <p><strong>মোবাইল:</strong> {toBn(invoice.dealerPhone || dealer?.phone || dealer?.mobile || dealer?.phoneNumber || '—')}</p>
        </div>
        <div className="invoice-party invoice-party-invoice">
          <h2>চালান তথ্য</h2>
          <p><strong>চালান নং:</strong> {toBn(invoice.challanNo || '—')}</p>
          <p><strong>ইনভয়েস নং:</strong> {toBn(formatInvoiceNumber(invoice.invoiceNo || invoice.id))}</p>
          <p><strong>তারিখ:</strong> {toBnDate(invoice.date)}</p>
          <p className="invoice-officer-code"><strong>অফিসার কোড:</strong> {toBn(formatOfficerCode(invoice.officerCode, invoice.officerDesignation) || invoice.officerId || '—')}</p>
          <p><strong>পরিবহন মাধ্যম:</strong> {invoice.transport || '—'}</p>
        </div>
      </section>

      <section className="invoice-table-section">
        <h2 className="invoice-section-heading">সরবরাহকৃত পণ্য ও পরিমাণের তালিকা</h2>
        <div className="invoice-table-scroll">
          <table className="invoice-items-table">
            <colgroup>
              <col className="invoice-col-index" />
              <col className="invoice-col-product" />
              <col className="invoice-col-cartons" />
              <col className="invoice-col-unit-price" />
              <col className="invoice-col-trade" />
              <col className="invoice-col-commission-percent" />
              <col className="invoice-col-commission" />
              <col className="invoice-col-net" />
            </colgroup>
            <thead>
              <tr>
                <th>নং</th>
                <th>পণ্যের নাম ও প্যাক সাইজ</th>
                <th>পরিমাণ</th>
                <th>ট্রেড প্রাইজ</th>
                <th>মোট ট্রেড প্রাইজ</th>
                <th>কমিশন (%)</th>
                <th>কমিশন এ্যামাউন্ট</th>
                <th>নীট মূল্য</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const values = getItemValues(item);
                return (
                  <tr key={`${item.sku || item.productId}-${index}`}>
                    <td className="invoice-number-cell">{toBn(index + 1)}</td>
                    <td className="invoice-product-name">
                      {getProductDescription(item)}
                    </td>
                    <td>{toBn(values.cartons)} {values.quantityUnit}</td>
                    <td>{money(values.unitTradePrice)}</td>
                    <td>{money(values.tradePrice)}</td>
                    <td>{toBn(values.commissionPercent)}%</td>
                    <td>{money(values.commission)}</td>
                    <td>{money(values.net)}</td>
                  </tr>
                );
              })}
              {!items.length && (
                <tr><td colSpan="8" className="invoice-empty-row">কোনো পণ্য নেই</td></tr>
              )}
              <tr className="invoice-table-total">
                <th colSpan="2">মোট প্যাকেজ</th>
                <th>{toBn(itemTotals.cartons)}</th>
                <th>—</th>
                <th>{money(itemTotals.tradePrice)}</th>
                <th>—</th>
                <th>{money(itemTotals.commission)}</th>
                <th>{money(itemTotals.net)}</th>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {returns.length > 0 && (
        <section className="invoice-table-section">
          <h2 className="invoice-section-heading">মেয়াদ উত্তীর্ণ / ফেরত পণ্য সমন্বয় (বিল কর্তন):</h2>
          <div className="invoice-table-scroll">
            <table className="invoice-returns-table">
              <colgroup>
                <col className="invoice-return-product" />
                <col className="invoice-return-quantity" />
                <col className="invoice-return-price" />
                <col className="invoice-return-total" />
              </colgroup>
              <thead>
                <tr>
                  <th>ফেরত পণ্য ও সাইজ</th>
                  <th>সংখ্যা</th>
                  <th>দর (ট)</th>
                  <th>সমন্বয় কর্তন (ট)</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((item, index) => {
                  const values = getReturnValues(item);
                  const quantityUnit = getPackageQuantityUnit(item);
                  return (
                    <tr key={`${item.sku || item.productId}-return-${index}`}>
                      <td className="invoice-product-name">{getProductDescription({ ...item, productName: item.productName || 'ফেরত পণ্য' })}</td>
                      <td>{quantityUnit === 'কার্টুন'
                        ? <>{toBn(values.cartons)} কার্টুন{values.loosePieces > 0 && ` ${toBn(values.loosePieces)} ${item.unit || 'পিস/বোতল'}`}</>
                        : <>{toBn(values.quantity)} {quantityUnit}</>}</td>
                      <td>{money(values.price)}</td>
                      <td className="invoice-return-deduction">− {money(values.total)}</td>
                    </tr>
                  );
                })}
                <tr className="invoice-table-total">
                  <th colSpan="3">মোট ফেরত সমন্বয়</th>
                  <th className="invoice-return-deduction">− {money(returnTotal)}</th>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="invoice-summary-grid">
        <div className="invoice-notes">
          <h2 className="invoice-section-heading">বিতরণ ও পরিশোধের বিবরণ</h2>
          <p><strong>চালান মন্তব্য:</strong> {invoice.deliveryComment || defaultComment}</p>
          <p><strong>পেমেন্ট মেথড:</strong> {paymentMethod}</p>
          <p><strong>নোট:</strong> {invoice.note || defaultNote}</p>
        </div>
        <div className="invoice-totals">
          <div><span>মোট প্যাকেজ</span><strong>{toBn(itemTotals.cartons)}</strong></div>
          <div><span>মোট ট্রেড প্রাইজ</span><strong>{money(itemTotals.tradePrice)}</strong></div>
          <div><span>ট্রেড কমিশন</span><strong>− {money(itemTotals.commission)}</strong></div>
          {transportCost > 0 && <div><span>পরিবহন খরচ</span><strong>+ {money(transportCost)}</strong></div>}
          {returns.length > 0 && <div><span>ফেরত মাল সমন্বয় কর্তন</span><strong>− {money(returnTotal)}</strong></div>}
          <div className="invoice-total-emphasis"><span>চালানের নীট বিল</span><strong>{money(invoiceNet)}</strong></div>
          <div><span>পূর্বের বকেয়া</span><strong>+ {money(previousDue)}</strong></div>
          <div><span>নগদ / চেক জমা</span><strong>− {money(paidAmount)}</strong></div>
          <div className="invoice-due-total"><span>বর্তমান অবশিষ্ট বকেয়া</span><strong>{money(currentDue)}</strong></div>
        </div>
      </section>

      <footer className="invoice-signatures">
        <div>ডিলারের স্বাক্ষর ও সীল</div>
        <div>সেলস অফিসারের স্বাক্ষর ও তারিখ</div>
        <div>কোম্পানির পক্ষে লজিস্টিক অফিসারের স্বাক্ষর ও তারিখ</div>
      </footer>
    </article>
  );
}
