export function createInitialState() {
  return {
    headers: [],
    rows: [],
    reportHeaders: [],
    reportRows: [],
    reportNotes: [],
    reportSource: null,
    reportDataStatus: "idle",
    reportDataKey: "",
    reportDataError: "",
    reportChartEnabled: false,
    favoriteReports: [],
    backups: [],
    availableData: [],
    availableYears: [],
    currentModule: "",
    currentView: "start",
    currentReportKey: "package-status",
    format: "-",
    fileName: "",
  };
}
