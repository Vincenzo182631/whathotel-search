/*
 * LiveAvatar session-token endpoint (Cloudflare Pages Functions).
 * Route: /api/liveavatar-token  (file path functions/api/liveavatar-token.js)
 *
 * Set in Cloudflare Pages → Settings → Environment variables:
 *   LIVEAVATAR_API_KEY, LIVEAVATAR_AVATAR_ID   (optional: LIVEAVATAR_SANDBOX)
 *
 * The secret API key stays on the edge; the browser only receives session_token.
 */
export async function onRequest(context) {
  var env = context.env || {};
  var apiKey = env.LIVEAVATAR_API_KEY;
  var avatarId = env.LIVEAVATAR_AVATAR_ID;
  var json = function (status, body) {
    return new Response(JSON.stringify(body), { status: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  };

  if (!apiKey || !avatarId) return json(503, { error: "not_configured" });

  try {
    var upstream = await fetch("https://api.liveavatar.com/v1/sessions/token", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id: avatarId,
        is_sandbox: String(env.LIVEAVATAR_SANDBOX) === "true"
      })
    });
    var data = await upstream.json().catch(function () { return null; });
    var token = data && data.data && data.data.session_token;
    if (!upstream.ok || !token) return json(502, { error: "token_request_failed", status: upstream.status });
    return json(200, { session_token: token, session_id: data.data.session_id || null });
  } catch (e) {
    return json(502, { error: "upstream_error" });
  }
}
