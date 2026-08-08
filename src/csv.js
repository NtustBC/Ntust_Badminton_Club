const quoteCsvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export const downloadCsv = ({ filename, headers, rows }) => {
  const content = [headers, ...rows].map((row) => row.map(quoteCsvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
