import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { PAYMENT_METHODS, type PaymentMethod } from '../types/taskpay';
import { PaymentMethodLogo } from './PaymentMethodLogo';

interface PaymentMethodDropdownProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

export const PaymentMethodDropdown: React.FC<PaymentMethodDropdownProps> = ({
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selected = PAYMENT_METHODS.find((m) => m.name === value) ?? PAYMENT_METHODS[0];

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={wrapRef} className="relative" dir="ltr">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border border-[#00FF66]/35 bg-[#050505] px-3.5 py-2 text-start transition-colors hover:border-[#00FF66] cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <PaymentMethodLogo method={selected.name} size={32} />
          <div className="min-w-0">
            <div className="font-display text-sm font-extrabold text-white truncate">
              {selected.displayName}
            </div>
            <div className="text-[11px] text-[#9cb3a5] truncate">{selected.tagline}</div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#00FF66] transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Payment Methods"
          className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-[#00FF66]/40 bg-[#0b0e0c] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.95)]"
        >
          {PAYMENT_METHODS.map((pm) => {
            const isSelected = pm.name === value;
            return (
              <li key={pm.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(pm.name);
                    setOpen(false);
                  }}
                  className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-start transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#00FF66]/15 text-[#00FF66]'
                      : 'text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PaymentMethodLogo method={pm.name} size={28} />
                    <div className="min-w-0">
                      <div className="font-display text-xs font-extrabold truncate">
                        {pm.displayName}
                      </div>
                      <div className="text-[10px] text-[#9cb3a5] truncate">{pm.tagline}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-[#00FF66]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
