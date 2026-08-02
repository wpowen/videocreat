export function classifyCoverQcRerun({ exitCode, result } = {}) {
  return Number(exitCode) === 0 && result?.ok === true
    ? "qc-rerun-complete"
    : "qc-rerun-review-only";
}
