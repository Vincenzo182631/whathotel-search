/*
 * LiveAvatar session-token endpoint (Vercel-style serverless function; also
 * works on most Node serverless runtimes).
 *
 * The browser NEVER sees the API key. This function exchanges the secret key
 * for a short-lived session_token that the LiveAvatar Web SDK uses to connect.
 *
 * Required environment variables (set them in your host's dashboard, NOT here):
 *   LIVEAVATAR_API_KEY    your (rotated) key from app.liveavatar.com/developers
 *   LIVEAVATAR_AVATAR_ID  the avatar UUID from the LiveAvatar dashboard
 * Optional:
 *   LIVEAVATAR_SANDBOX    "true" to create sandbox sessions
 *
 * Deploy path: /api/liveavatar-token  (Vercel serves files in /api automatically)
 */
export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "POST, GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  var apiKey = process.env.LIVEAVATAR_API_KEY;
  // Avatar UUID is not a secret; env var overrides this default.
  var avatarId = process.env.LIVEAVATAR_AVATAR_ID || "073b60a9-89a8-45aa-8902-c358f64d2852";
  if (!apiKey) {
    // No API key set yet — the client falls back to the iframe embed.
    return res.status(503).json({ error: "not_configured" });
  }

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
    var json = await upstream.json().catch(function () { return null; });
    var token = json && json.data && json.data.session_token;
    if (!upstream.ok || !token) {
      return res.status(502).json({ error: "token_request_failed", status: upstream.status });
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      session_token: token,
      session_id: json.data.session_id || null
    });
  } catch (e) {
    return res.status(502).json({ error: "upstream_error" });
  }
}
