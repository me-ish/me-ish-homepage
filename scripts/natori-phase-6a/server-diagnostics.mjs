import { StringDecoder } from 'node:string_decoder';

const errorCodes = ['Module not found', 'Failed to compile', 'SyntaxError', 'EADDRINUSE'];
// Only fixed classifications leave the process. Never retain raw messages,
// request bodies, URLs, cookies, credentials or arbitrary stack paths.
const markers = [
  ['json_truncated', 'Unexpected end of JSON input'],
  ['json_unexpected_token', 'Unexpected token'],
  ['json_expected_property', 'Expected property name'],
  ['json_trailing_content', 'Unexpected non-whitespace character'],
  ['json_parse', 'JSON.parse'],
  ['request_json', 'parseJSONFromBytes'],
  ['next_manifest', 'load-manifest'],
  ['next_components', 'load-components'],
  ['next_dev_server', 'next-dev-server'],
  ['next_hot_reloader', 'hot-reloader'],
  ['next_webpack_cache', 'webpack.cache'],
  ['next_server_actions', 'server-reference-manifest'],
  ['next_build_manifest', 'build-manifest'],
  ['next_routes_manifest', 'routes-manifest'],
  ['next_app_paths_manifest', 'app-paths-manifest'],
  ['next_font_manifest', 'next-font-manifest'],
  ['next_pages_manifest', 'pages-manifest'],
  ['next_middleware_manifest', 'middleware-manifest'],
  ['project_route', 'api/natori/admin/projects'],
];

export function createServerDiagnostics({ getCaseIndex, onUpdate = () => {} }) {
  const codes = new Set(), events = [], streams = new Map();
  let omitted = 0;
  function snapshot() {
    return { codes: [...codes], events: structuredClone(events), omitted };
  }
  function line(text, stream) {
    const state = streams.get(stream);
    const found = errorCodes.filter(code => text.includes(code));
    if (found.length) {
      for (const code of found) codes.add(code);
      if (events.length < 32) {
        const index = getCaseIndex();
        state.event = { stream, caseIndex: Number.isInteger(index) && index >= 0 ? index : 0, codes: found, markers: [] };
        events.push(state.event);
      } else { state.event = null; omitted++; }
      state.remaining = 12;
    }
    if (state.remaining > 0) {
      if (state.event) for (const [code, needle] of markers) {
        if (text.includes(needle) && !state.event.markers.includes(code)) state.event.markers.push(code);
      }
      state.remaining--;
      onUpdate(snapshot());
    }
  }
  function write(stream, chunk) {
    if (!['stdout', 'stderr'].includes(stream)) throw new Error('DIAGNOSTIC_STREAM');
    if (!streams.has(stream)) streams.set(stream, { decoder: new StringDecoder('utf8'), pending: '', event: null, remaining: 0 });
    const state = streams.get(stream);
    state.pending += state.decoder.write(chunk);
    let end;
    while ((end = state.pending.indexOf('\n')) !== -1) {
      line(state.pending.slice(0, end), stream); state.pending = state.pending.slice(end + 1);
    }
    // Bound memory even if a dependency emits an unbounded line. Keep an
    // overlap so a marker spanning the boundary cannot disappear.
    while (state.pending.length > 16384) {
      line(state.pending.slice(0, 16384), stream); state.pending = state.pending.slice(16256);
    }
  }
  function flush() {
    for (const [stream, state] of streams) {
      state.pending += state.decoder.end();
      if (state.pending) line(state.pending, stream);
      state.pending = '';
    }
    return snapshot();
  }
  return { write, flush, snapshot, codes };
}
