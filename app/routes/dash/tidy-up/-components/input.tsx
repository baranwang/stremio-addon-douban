import type { FC } from "hono/jsx";

interface InputProps {
  name: string;
  value?: string | number | null;
  placeholder?: string;
  label?: string;
  type?: "text" | "number" | "email" | "password";
  disabled?: boolean;
  className?: string;
}

export const Input: FC<InputProps> = ({
  name,
  value,
  placeholder,
  label,
  type = "text",
  disabled = false,
  className = "",
}) => (
  <div className={`space-y-2 ${className}`}>
    {label && (
      <label htmlFor={name} className="block font-medium text-sm text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
    )}
    <input
      id={name}
      name={name}
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      className="flex h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-all duration-200 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-emerald-400 dark:placeholder:text-zinc-500"
    />
  </div>
);
