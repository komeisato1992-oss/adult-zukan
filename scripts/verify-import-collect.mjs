const DMM_ITEMLIST_MAX_HITS = 100;

function planCollectPages(requestCount, pageSize) {
  return Math.max(1, Math.ceil(requestCount / pageSize));
}

function nextCollectPageHits(requestCount, apiFetchedCount, pageSize) {
  return Math.min(pageSize, requestCount - apiFetchedCount);
}

function simulateFetch(requestCount) {
  const pageSize = DMM_ITEMLIST_MAX_HITS;
  const pages = [];
  let apiFetchedCount = 0;

  while (apiFetchedCount < requestCount) {
    const hits = nextCollectPageHits(requestCount, apiFetchedCount, pageSize);
    pages.push(hits);
    apiFetchedCount += hits;
  }

  return { pages, totalFetched: apiFetchedCount };
}

for (const requestCount of [10, 200, 300]) {
  const result = simulateFetch(requestCount);
  const ok = result.totalFetched === requestCount;
  console.log(
    `${ok ? "OK" : "NG"} request=${requestCount} pages=[${result.pages.join(",")}] total=${result.totalFetched} planned=${planCollectPages(requestCount, DMM_ITEMLIST_MAX_HITS)}`,
  );
}
