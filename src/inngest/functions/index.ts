import { hello } from "./hello";
import { ingestFeed } from "./ingest-feed";
import { processMediaFn } from "./process-media";
import { refreshRegionStatsFn } from "./refresh-region-stats";
import { nearbySaleFn, refreshValuationsFn, scoreValuationsFn } from "./valuations";

export const functions = [hello, ingestFeed, processMediaFn, refreshRegionStatsFn, refreshValuationsFn, scoreValuationsFn, nearbySaleFn];
