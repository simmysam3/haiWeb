import { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  help?: string;
  error?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, help, error, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-charcoal mb-1">
        {label}
      </label>
      {children}
      {help && !error && (
        <p className="text-xs text-slate mt-1">{help}</p>
      )}
      {error && (
        <p className="text-xs text-problem mt-1">{error}</p>
      )}
    </div>
  );
}
