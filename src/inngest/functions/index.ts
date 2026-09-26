import { dailyAlertsFn, instantAlertsFn, weeklyAlertsFn } from "./alerts";
import { eventsRetentionFn } from "./events-retention";
import { hello } from "./hello";
import { ingestFeed } from "./ingest-feed";
import { proResponseTimesFn, routeLeadFn, sweepLeadsFn } from "./leads";
import { processMediaFn } from "./process-media";
import { refreshRegionStatsFn } from "./refresh-region-stats";
import { regionSummariesFn } from "./region-summaries";
import { nearbySaleFn, refreshValuationsFn, scoreValuationsFn } from "./valuations";

export const functions = [
  hello,
  ingestFeed,
  processMediaFn,
  refreshRegionStatsFn,
  refreshValuationsFn,
  scoreValuationsFn,
  nearbySaleFn,
  routeLeadFn,
  sweepLeadsFn,
  proResponseTimesFn,
  instantAlertsFn,
  dailyAlertsFn,
  weeklyAlertsFn,
  regionSummariesFn,
  eventsRetentionFn,
];
