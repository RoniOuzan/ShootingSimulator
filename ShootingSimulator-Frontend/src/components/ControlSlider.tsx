import { useState, useEffect, useRef } from 'react';
import './ControlSlider.css';

interface ControlSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (val: number) => void;
  disabled?: boolean;
  precision?: number;
}

export default function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  disabled = false,
  precision = 2,
}: ControlSliderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setInputValue(value.toFixed(precision).replace(/\.?0+$/, ''));
    }
  }, [value, isEditing, precision]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
    } else {
      setInputValue(value.toString());
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setInputValue(value.toString());
      setIsEditing(false);
    }
  };

  const handleValueClick = () => {
    if (!disabled) {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  };

  return (
    <div className={`slider-wrapper ${disabled ? 'disabled' : ''}`}>
    <div className="slider-header">
        <span className="slider-label">{label}</span>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="slider-input"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            autoFocus
          />
        ) : (
          <span className="slider-value" onClick={handleValueClick} title="Click to edit">
            {value.toFixed(precision).replace(/\.?0+$/, '')}{unit}
          </span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
    </div>
  );
}
