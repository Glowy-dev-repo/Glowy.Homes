import { hello } from "./hello";
import { ingestFeed } from "./ingest-feed";
import { processMediaFn } from "./process-media";
import { refreshRegionStatsFn } from "./refresh-region-stats";

export const functions = [hello, ingestFeed, processMediaFn, refreshRegionStatsFn];
