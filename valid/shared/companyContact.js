export const HOTLINE_NUMBER = '01713736320';
export const HOTLINE_ADDRESS = 'নাদুরপুকুর, শাজাহানপুর, বগুড়া';
export const HEAD_OFFICE_ADDRESS = 'নিশিন্দারা, বগুড়া সদর, বগুড়া';

export function normalizeHotlineNumber(value) {
	const compact = String(value ?? '').replace(/[\s-]/g, '');
	return compact === '01796791398' || compact === '০১৭৯৬৭৯১৩৯৮'
		? HOTLINE_NUMBER
		: value;
}
