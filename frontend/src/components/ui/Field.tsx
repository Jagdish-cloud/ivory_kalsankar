import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import clsx from "clsx";

const baseFieldClasses =
  "w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-ink-100/40";

interface LabelProps {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

export function FieldWrapper({ label, hint, required, error, children }: LabelProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-xs font-semibold text-ink-700">
          {label}
          {required && <span className="text-brand-500"> *</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] font-medium text-red-600">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-[11px] text-ink-500">{hint}</span>
      )}
    </label>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
}

export function TextField({ label, hint, required, error, className, ...props }: TextFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint} required={required} error={error}>
      <input className={clsx(baseFieldClasses, error && "border-red-300 focus:border-red-400 focus:ring-red-100", className)} {...props} />
    </FieldWrapper>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  required?: boolean;
}

export function TextAreaField({ label, hint, required, className, ...props }: TextAreaFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint} required={required}>
      <textarea className={clsx(baseFieldClasses, "resize-none", className)} {...props} />
    </FieldWrapper>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}

export function SelectField({ label, hint, required, placeholder, className, children, ...props }: SelectFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint} required={required}>
      <select className={clsx(baseFieldClasses, "appearance-none bg-no-repeat", className)} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
    </FieldWrapper>
  );
}
