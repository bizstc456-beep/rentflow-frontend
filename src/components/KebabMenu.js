import React, { useState, useRef, useEffect } from 'react';

// A small "..." dropdown for actions that don't need to be one click away --
// keeps a row's primary buttons (Edit, Record payment, ...) from getting
// crowded out by less-frequent ones (Documents, Delete).
//
// items: [{ label, onClick, danger?: bool }]
export default function KebabMenu({ items, label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="rf-kebab" ref={ref}>
      <button
        type="button"
        className="rf-kebab-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        &#8942;
      </button>
      {open && (
        <div className="rf-kebab-menu" role="menu">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={`rf-kebab-item${item.danger ? ' danger' : ''}`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
