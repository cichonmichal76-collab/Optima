export function createInitialState() {
  return {
    headers: [],
    rows: [],
    reportHeaders: [],
    reportRows: [],
    reportDataStatus: "idle",
    reportDataKey: "",
    reportDataError: "",
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
