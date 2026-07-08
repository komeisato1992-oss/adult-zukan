/** @deprecated Version 1 互換用。新規コードは import-candidate-types を使用してください。 */
export type ImportCandidateSource = "new" | "random";

export type ImportCandidate = {
  source: ImportCandidateSource | string;
  sourceLabel: string;
  item: import("@/lib/dmm/types").DmmItem;
};
