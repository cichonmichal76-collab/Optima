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
    currentModule: "",
    currentView: "start",
    currentReportKey: "package-status",
    format: "-",
    fileName: "",
  };
}
