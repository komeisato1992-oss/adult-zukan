import { sendGaEvent } from "@/lib/gtag";

export const COMPARE_GA_EVENTS = {
  compareButtonClick: "compare_button_click",
  candidatePopupShow: "compare_candidate_popup_show",
  seeSimilarClick: "compare_see_similar_click",
  browseListClick: "compare_browse_list_click",
  laterClick: "compare_later_click",
  sortChange: "compare_select_sort_change",
  pageChange: "compare_select_page_change",
  candidateSelect: "compare_candidate_select",
  comparePageReach: "compare_page_reach",
  relatedClick: "compare_related_click",
  fanzaClick: "compare_fanza_click",
  floatingPanelShow: "compare_floating_panel_show",
  floatingSeeFeatureClick: "compare_floating_see_feature_click",
  floatingRandomPairSuccess: "compare_floating_random_pair_success",
  floatingRandomPairFail: "compare_floating_random_pair_fail",
  floatingGoCompareClick: "compare_floating_go_compare_click",
  floatingClearClick: "compare_floating_clear_click",
} as const;

export function trackCompareEvent(
  eventName: (typeof COMPARE_GA_EVENTS)[keyof typeof COMPARE_GA_EVENTS],
  params?: Record<string, string | number | boolean | undefined | null>,
): void {
  sendGaEvent(eventName, params);
}
