function plainTextError(text) {
  const value = String(text || '').trim();
  if (!value || value.length > 1000 || /<\/?[a-z][\s\S]*>/i.test(value)) return '';
  return value;
}

export async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  let result;

  if (/json/i.test(contentType)) {
    try {
      result = JSON.parse(text);
    } catch {
      result = null;
    }
  }

  if (!response.ok) {
    const message = result?.message || result?.error || plainTextError(text)
      || 'অনুরোধ সম্পন্ন করা যায়নি।';
    throw new Error(message);
  }

  if (!/json/i.test(contentType) || result === null) {
    throw new Error('সার্ভার থেকে সঠিক প্রতিক্রিয়া পাওয়া যায়নি।');
  }

  return result;
}
