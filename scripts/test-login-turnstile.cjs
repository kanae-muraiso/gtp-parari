const fs = require("node:fs");
const assert = require("node:assert/strict");

const login = fs.readFileSync("src/app/login/page.tsx","utf8");
const widget = fs.readFileSync("src/components/parari/auth/LoginTurnstile.tsx","utf8");

// When no public key exists, preserve existing magic-link login behavior.
assert.match(login, /const TURNSTILE_SITE_KEY = process\.env\.NEXT_PUBLIC_TURNSTILE_SITE_KEY\?\.trim\(\) \|\| ""/);
assert.match(login, /TURNSTILE_SITE_KEY && <LoginTurnstile/);
assert.match(login, /\.\.\.\(TURNSTILE_SITE_KEY \? \{ captchaToken: captchaToken! \} : \{\}\)/);
assert.match(login, /!TURNSTILE_SITE_KEY \|\| Boolean\(captchaToken\)/);

// A token is required and refreshed whenever Cloudflare protection is configured.
assert.match(login, /if \(TURNSTILE_SITE_KEY && !captchaToken\)/);
assert.match(login, /captchaResetNonce/);
assert.match(login, /setHasSent\(false\)/);
assert.match(widget, /"expired-callback": \(\) => tokenCallback\.current\(null\)/);
assert.match(widget, /"error-callback": \(\) => \{/);
assert.match(widget, /turnstileApi\(\)\?\.reset\(widget\.current\)/);
assert.match(widget, /turnstile\.render|api\.render/);

// The server-side CAPTCHA secret must never be embedded in the browser bundle.
assert.doesNotMatch(login + widget, /TURNSTILE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
console.log("Magic-link Turnstile rollout wiring checks passed");
