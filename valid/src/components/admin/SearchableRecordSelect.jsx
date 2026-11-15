import React, { useId, useMemo, useState } from 'react';

export default function SearchableRecordSelect({
  label,
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  optionLabel,
  searchText,
  required = true,
  resultsPlacement = 'bottom'
}) {
  const resultsId = useId();
  const [query, setQuery] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const matchingItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return !normalizedQuery
      ? items
      : items.filter((item) => searchText(item).toLocaleLowerCase().includes(normalizedQuery));
  }, [items, query, searchText]);
  const filteredItems = useMemo(() => {
    const selected = items.find((item) => item.id === value);
    return selected && !matchingItems.some((item) => item.id === selected.id)
      ? [selected, ...matchingItems]
      : matchingItems;
  }, [items, matchingItems, value]);

  return (
    <div
      className="relative min-w-0 text-sm font-semibold text-slate-700"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setResultsOpen(false);
      }}
    >
      <span>{label}</span>
      <input
        type="search"
        value={query}
        onFocus={() => setResultsOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setResultsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setResultsOpen(false);
        }}
        placeholder={searchPlaceholder}
        aria-label={`${label} কোড বা নাম দিয়ে খুঁজুন`}
        aria-controls={resultsId}
        aria-expanded={resultsOpen}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
      />
      {resultsOpen && matchingItems.length > 0 && (
        <div
          id={resultsId}
          role="listbox"
          className={`absolute z-40 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl ${
            resultsPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {matchingItems.slice(0, 100).map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(item.id);
                setQuery('');
                setResultsOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm font-normal hover:bg-emerald-50 ${
                item.id === value ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700'
              }`}
            >
              {optionLabel(item)}
            </button>
          ))}
        </div>
      )}
      {resultsOpen && !matchingItems.length && (
        <p
          id={resultsId}
          role="status"
          className={`absolute z-40 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-500 shadow-xl ${
            resultsPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          কোনো ফলাফল পাওয়া যায়নি
        </p>
      )}
      <select
        required={required}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setQuery('');
          setResultsOpen(false);
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
