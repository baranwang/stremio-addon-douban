import type { Child, FC } from "hono/jsx";

interface TableProps {
  children: Child;
  className?: string;
}

export const Table: FC<TableProps> = ({ children, className = "" }) => (
  <div className="relative w-full overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
    <table className={`w-full caption-bottom text-sm ${className}`}>{children}</table>
  </div>
);

interface TableHeaderProps {
  children: Child;
  className?: string;
}

export const TableHeader: FC<TableHeaderProps> = ({ children, className = "" }) => (
  <thead className={`bg-zinc-50 dark:bg-zinc-900 [&_tr]:border-b ${className}`}>{children}</thead>
);

interface TableBodyProps {
  children: Child;
  className?: string;
}

export const TableBody: FC<TableBodyProps> = ({ children, className = "" }) => (
  <tbody className={`[&_tr:last-child]:border-0 ${className}`}>{children}</tbody>
);

interface TableRowProps {
  children: Child;
  className?: string;
  onclick?: string;
}

export const TableRow: FC<TableRowProps> = ({ children, className = "", onclick }) => (
  <tr
    className={`border-zinc-200 border-b transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50 ${className}`}
    onclick={onclick}
  >
    {children}
  </tr>
);

interface TableHeadProps {
  children: Child;
  className?: string;
}

export const TableHead: FC<TableHeadProps> = ({ children, className = "" }) => (
  <th className={`h-11 px-4 text-left align-middle font-semibold text-zinc-600 dark:text-zinc-400 ${className}`}>
    {children}
  </th>
);

interface TableCellProps {
  children: Child;
  className?: string;
}

export const TableCell: FC<TableCellProps> = ({ children, className = "" }) => (
  <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>
);
