import React, { useMemo, useState } from 'react';

export default function SearchableRecordSelect({
  label,
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  optionLabel,
  searchText
}) {
  const [query, setQuery] = useState('');
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matches = !normalizedQuery
      ? items
      : items.filter((item) => searchText(item).toLocaleLowerCase().includes(normalizedQuery));
    const selected = items.find((item) => item.id === value);
    return selected && !matches.some((item) => item.id === selected.id)
      ? [selected, ...matches]
      : matches;
  }, [items, query, searchText, value]);

  return (
    <div className="min-w-0 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={`${label} কোড বা নাম দিয়ে খুঁজুন`}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
      />
      <select
        required
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setQuery('');
        }}
        aria-label={label}
        className="mt-2 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2"
      >
        <option value="">{placeholder}</option>
        {filteredItems.map((item) => (
          <option key={item.id} value={item.id}>{optionLabel(item)}</option>
        ))}
        {!filteredItems.length && <option value="" disabled>কোনো ফলাফল পাওয়া যায়নি</option>}
      </select>
    </div>
  );
}
