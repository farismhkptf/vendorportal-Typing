type ExportColumn<T> = {
  header: string;
  accessor: (item: T) => string | number | null | undefined;
};

export function exportToCsv<T>(
  items: T[],
  columns: ExportColumn<T>[],
  filename: string
) {
  const headers = columns.map(c => c.header);
  const rows = items.map(item =>
    columns.map(col => {
      const val = col.accessor(item);
      const str = val == null ? "" : String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    })
  );

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyTableToClipboard<T>(
  items: T[],
  columns: ExportColumn<T>[]
): Promise<void> {
  const headers = columns.map(c => c.header);
  const rows = items.map(item =>
    columns.map(col => {
      const val = col.accessor(item);
      return val == null ? "" : String(val);
    })
  );
  const text = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
  await navigator.clipboard.writeText(text);
}
