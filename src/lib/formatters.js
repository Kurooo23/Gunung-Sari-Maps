const INDONESIAN_MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatPeriodLabel(periodString) {
  if (!periodString) return "-";
  const [yearPart, monthPart] = periodString.split("-");
  const monthIndex = Number(monthPart) - 1;
  const monthName = INDONESIAN_MONTH_NAMES[monthIndex] || monthPart;
  return `${monthName} ${yearPart}`;
}

export function formatUpdatedAtTimestamp(isoDateString) {
  if (!isoDateString) return "-";
  const parsedDate = new Date(isoDateString);
  if (Number.isNaN(parsedDate.getTime())) return "-";
  return parsedDate.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getCaseCountBadgeClass(caseCount) {
  if (caseCount === 0) return "badge-green";
  if (caseCount <= 2) return "badge-yellow";
  return "badge-red";
}

