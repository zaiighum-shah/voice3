# Voxora AI — Premium TTS SaaS Frontend

Multi-page HTML/CSS/JS build with a premium light/dark UI, Supabase email/password auth, configurable Railway TTS adapter, voice library, preview, MP3 export workflow, history, settings and a product-help chat.

## Before publishing

Open `config.js` and replace:

`PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE`

with the Publishable key from Supabase → Settings → API Keys.

Do not put a secret/service-role key in the frontend.

The Railway base URL is prefilled:
`https://tts-backend-production-9a13.up.railway.app`

The default paths are `/`, `/voices`, `/generate`. Change them if your backend exposes different routes.

The Studio POST body is:
{text, voice, accent, speed, pitch, volume, format:"mp3"}

If your backend expects another request/response shape, edit the `generate()` adapter in `assets/app.js`.

## Auth

You have currently disabled Confirm email for testing, so signup can create a session directly. For production, turn email confirmation back on and configure Supabase Authentication → URL Configuration.

## Gemini

Do not expose a Gemini API key in GitHub Pages. Put Gemini behind your server/backend and set only the chat endpoint in `config.js` or Settings. Without an endpoint, the built-in product guide still answers common usage questions.

## Character limits

The editor intentionally has no artificial 5,000-character UI limit. Actual generation limits are controlled by your backend/provider, so the frontend cannot honestly promise unlimited generation by itself.

## Publish

Upload the folder to GitHub Pages. There is no build step.
