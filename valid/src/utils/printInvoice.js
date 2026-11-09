export function printInvoiceSheet(sheet) {
  if (!sheet) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.alert('প্রিন্ট উইন্ডো খোলা যায়নি। ব্রাউজারের পপ-আপ অনুমতি দিয়ে আবার চেষ্টা করুন।');
    return;
  }

  const stylesheetLinks = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map((link) => `<link rel="stylesheet" href="${link.href}">`)
    .join('');
  const inlineStyles = [...document.querySelectorAll('style')]
    .map((style) => style.outerHTML)
    .join('');

  printWindow.addEventListener('load', async () => {
    await printWindow.document.fonts.ready;
    printWindow.focus();
    printWindow.print();
  }, { once: true });
  printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="bn">
      <head>
        <meta charset="utf-8">
        <base href="${window.location.href}">
        <title>ইনভয়েস প্রিন্ট</title>
        ${stylesheetLinks}
        ${inlineStyles}
      </head>
      <body>${sheet.outerHTML}</body>
    </html>`);
  printWindow.document.close();
}
