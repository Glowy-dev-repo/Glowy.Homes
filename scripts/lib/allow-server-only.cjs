// Preload for Node scripts (the phase gate) that exercise server modules outside Next:
// `server-only` exists to stop client bundles importing them, and throws anywhere but a
// react-server build. Scripts are server code, so treat it as the empty module it is there.
const path = require.resolve("server-only");
require.cache[path] = { id: path, filename: path, loaded: true, exports: {} };
