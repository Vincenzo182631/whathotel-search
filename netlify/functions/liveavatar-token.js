/*
 * LiveAvatar session-token endpoint (Netlify Functions).
 * Exchanges the secret API key (env var) for a short-lived session_token so the
 * key never reaches the browser.
 *
 * Set in Netlify → Site settings → Environment variables:
 *   LIVEAVATAR_API_KEY, LIVEAVATAR_AVATAR_ID   (optional: LIVEAVATAR_SANDBOX)
 *
 * netlify.toml maps /api/liveavatar-token → this function.
 */
exports.handler = async function () {
  var apiKey = process.env.LIVEAVATAR_API_KEY;
  var avatarId = process.env.LIVEAVATAR_AVATAR_ID;
  var json = function (status, body) {
    return { statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
  };

  if (!apiKey || !avatarId) return json(503, { error: "not_configured" });

  try {
    var upstream = await fetch("https://api.liveavatar.com/v1/sessions/token", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "FULL",
        avatar_id: avatarId,
        is_sandbox: String(process.env.LIVEAVATAR_SANDBOX) === "true"
      })
    });
    var data = await upstream.json().catch(function () { return null; });
    var token = data && data.data && data.data.session_token;
    if (!upstream.ok || !token) return json(502, { error: "token_request_failed", status: upstream.status });
    return json(200, { session_token: token, session_id: data.data.session_id || null });
  } catch (e) {
    return json(502, { error: "upstream_error" });
  }
};
