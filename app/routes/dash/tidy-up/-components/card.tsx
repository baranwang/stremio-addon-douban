import type { Child, FC } from "hono/jsx";

interface CardProps {
  children: Child;
  className?: string;
}

export const Card: FC<CardProps> = ({ children, className = "" }) => (
  <div
    className={`rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
  >
    {children}
  </div>
);

interface CardHeaderProps {
  children: Child;
  className?: string;
}

export const CardHeader: FC<CardHeaderProps> = ({ children, className = "" }) => (
  <div className={`mb-4 ${className}`}>{children}</div>
);

interface CardTitleProps {
  children: Child;
  className?: string;
}

export const CardTitle: FC<CardTitleProps> = ({ children, className = "" }) => (
  <h3 className={`font-semibold text-lg text-zinc-900 dark:text-zinc-100 ${className}`}>{children}</h3>
);

interface CardDescriptionProps {
  children: Child;
  className?: string;
}

export const CardDescription: FC<CardDescriptionProps> = ({ children, className = "" }) => (
  <p className={`mt-1 text-sm text-zinc-500 dark:text-zinc-400 ${className}`}>{children}</p>
);

interface CardContentProps {
  children: Child;
  className?: string;
}

export const CardContent: FC<CardContentProps> = ({ children, className = "" }) => (
  <div className={className}>{children}</div>
);

interface CardFooterProps {
  children: Child;
  className?: string;
}

export const CardFooter: FC<CardFooterProps> = ({ children, className = "" }) => (
  <div className={`mt-4 flex items-center ${className}`}>{children}</div>
);
