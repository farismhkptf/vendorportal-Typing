export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  
  const d = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return "";
  
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  
  return `${day}-${month}-${year}`;
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  
  const d = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return "";
  
  const dateStr = formatDate(d);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  
  return `${dateStr} ${displayHours}:${minutes} ${ampm}`;
}

export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return "";
  
  const d = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return "";
  
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateWithWeekday(date: Date | string | null | undefined): string {
  if (!date) return "";
  
  const d = typeof date === "string" ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return "";
  
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const now = Date.now();
  const diff = now - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}
