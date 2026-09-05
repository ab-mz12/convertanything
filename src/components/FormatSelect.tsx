import { ChevronDown } from 'lucide-react';
import { FORMATS, type FormatId } from '../utils/formats';

interface FormatSelectProps {
  value: FormatId | undefined;
  options: FormatId[];
  disabled?: boolean;
  onChange: (target: FormatId) => void;
  label?: string;
}

export function FormatSelect({ value, options, disabled, onChange, label = 'Target format' }: FormatSelectProps) {
  return (
    <span className="relative inline-block">
      <select
        className="select appearance-none"
        value={value ?? ''}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.target.value as FormatId)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {FORMATS[option].label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="muted pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
    </span>
  );
}
