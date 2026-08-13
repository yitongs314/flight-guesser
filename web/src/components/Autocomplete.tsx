import { useMemo, useRef, useState } from 'react';

export interface ACItem {
  code: string;
  /** Short codes (IATA/ICAO) that should rank as exact matches, lowercase. */
  codes: string[];
  label: string;
  sub: string;
  haystack: string;
}

interface Props {
  items: ACItem[];
  placeholder: string;
  selected: ACItem | null;
  onSelect: (item: ACItem | null) => void;
  disabled?: boolean;
}

export default function Autocomplete({ items, placeholder, selected, onSelect, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<number | undefined>(undefined);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const ranked: { item: ACItem; rank: number }[] = [];
    for (const item of items) {
      let rank: number;
      if (item.codes.some((c) => c === q)) rank = 0;
      else if (item.codes.some((c) => c.startsWith(q))) rank = 1;
      else if (item.haystack.includes(` ${q}`)) rank = 2;
      else if (item.haystack.includes(q)) rank = 3;
      else continue;
      ranked.push({ item, rank });
    }
    ranked.sort((a, b) => a.rank - b.rank || a.item.label.localeCompare(b.item.label));
    return ranked.slice(0, 8).map((r) => r.item);
  }, [items, query]);

  const pick = (item: ACItem) => {
    onSelect(item);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="ac">
      <input
        className="ac-input"
        disabled={disabled}
        placeholder={placeholder}
        value={selected ? selected.label : query}
        onChange={(e) => {
          let next = e.target.value;
          if (selected) {
            // Editing a chosen entry starts a fresh search. Keep only what the
            // user actually typed: an append keeps the new chars, a deletion
            // clears, a wholesale replacement keeps the replacement.
            if (next.startsWith(selected.label)) next = next.slice(selected.label.length);
            else if (selected.label.startsWith(next)) next = '';
            onSelect(null);
          }
          setQuery(next);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={(e) => {
          // Select the text so typing over a previous choice just replaces it.
          e.target.select();
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter' && matches[highlight]) {
            e.preventDefault();
            pick(matches[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 && (
        <div className="ac-drop">
          {matches.map((item, i) => (
            <button
              key={item.code}
              className={`ac-item ${i === highlight ? 'highlight' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                window.clearTimeout(blurTimer.current);
                pick(item);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span className="ac-label">{item.label}</span>
              <span className="ac-sub">{item.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
