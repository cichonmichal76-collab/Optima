export async function exportReportFile(payload) {
  const response = await fetch("/api/report-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || result.error) {
    throw new Error(result.error || "Nie udało się przygotować eksportu raportu.");
  }
  triggerDownload(result.download_url, result.file_name);
  return result;
}

function triggerDownload(url, fileName) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
}
