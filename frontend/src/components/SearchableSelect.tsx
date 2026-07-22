import { useState } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  disabled = false,
  allowCustom = false,
  allowClear = true,
  emptyLabel = 'Sin resultados.',
}: {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCustom?: boolean;
  allowClear?: boolean;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedOption = options.find((o) => o.value === value);
  const displayValue = open ? search : (allowCustom ? value : (selectedOption?.label ?? ''));

  const filtered = options.filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return o.label.toLowerCase().includes(q) || (o.sublabel || '').toLowerCase().includes(q);
  });

  const handleFocus = () => {
    setSearch('');
    setOpen(true);
  };

  const handleInputChange = (text: string) => {
    setSearch(text);
    if (allowCustom) onChange(text);
  };

  const handleSelect = (option: SearchableSelectOption) => {
    onChange(option.value);
    setSearch('');
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSearch('');
  };

  return (
    <div className="relative">
      <div className={`flex items-center bg-white border rounded-xl overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 ${value ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'} ${disabled ? 'bg-slate-50' : ''}`}>
        <Search className="h-4 w-4 text-slate-400 ml-3 flex-shrink-0" />
        <input
          type="text"
          disabled={disabled}
          value={displayValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 py-2.5 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
        />
        {allowClear && value && !disabled && (
          <button
            type="button"
            onMouseDown={handleClear}
            className="mr-3 text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-400">{emptyLabel}</p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={() => handleSelect(option)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 hover:text-blue-800 transition-colors ${option.value === value ? 'bg-blue-50/60 text-blue-700 font-medium' : 'text-slate-700'}`}
              >
                {option.label}
                {option.sublabel && <span className="text-xs text-slate-400 ml-1.5">{option.sublabel}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
