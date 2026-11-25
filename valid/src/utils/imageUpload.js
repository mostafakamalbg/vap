const MAX_IMAGE_BYTES = 1_500_000;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function readImageFile(file) {
  if (!file || !ACCEPTED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
    return Promise.reject(new Error('JPEG, PNG বা WebP ছবি ১.৫ এমবির মধ্যে নির্বাচন করুন।'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('ছবিটি পড়া যায়নি।'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error('ছবিটি পড়া যায়নি।'));
    reader.readAsDataURL(file);
  });
}
