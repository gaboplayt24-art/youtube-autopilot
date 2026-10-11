# TikTok setup (owner, one time)

The pipeline sends each QA-passed vertical Short to TikTok through the **official Content Posting API**. Without the three secrets below the TikTok step is skipped and logged; YouTube publishing is unaffected.

1. Go to https://developers.tiktok.com, log in with the channel's TikTok account and create an app (**Manage apps → Connect an app**).
2. Fill in the app details: name, icon (the Eli logo), category *Entertainment*, description, and the same **privacy policy** and **terms** links used for Google (a public Google Doc works).
3. Add the products **Login Kit** and **Content Posting API**. In Content Posting API enable **Direct Post** (optional) and keep **Upload** (drafts to the inbox).
4. Scopes: `user.info.basic`, `video.upload`, `video.publish`.
5. Login Kit → **Redirect URI**: `https://github.com/gaboplayt24-art/youtube-autopilot` (any HTTPS page you control works; the code just appears in the address bar).
6. While the app is not yet approved, open **Sandbox**, add your TikTok account as a *target user* and use the sandbox Client key/secret.
7. Authorize once: open (replace `CLIENT_KEY`)
   `https://www.tiktok.com/v2/auth/authorize/?client_key=CLIENT_KEY&scope=user.info.basic,video.upload,video.publish&response_type=code&redirect_uri=https%3A%2F%2Fgithub.com%2Fgaboplayt24-art%2Fyoutube-autopilot&state=bu1`
   Accept, then copy the `code=` value from the address bar (it expires in minutes).
8. In your own computer's Terminal (never paste these values in a chat) exchange it:
   ```
   curl -s -X POST https://open.tiktokapis.com/v2/oauth/token/ \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -d client_key=CLIENT_KEY -d client_secret=CLIENT_SECRET \
     -d grant_type=authorization_code -d code=CODE \
     -d redirect_uri=https://github.com/gaboplayt24-art/youtube-autopilot
   ```
   The answer contains `refresh_token` (valid about one year).
9. GitHub → repository **Settings → Secrets and variables → Actions → New repository secret**: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`.
10. Submit the app for review when ready. Until it is approved, keep `config/tiktok.json` `mode: "inbox"`: each Short arrives as a draft notification in the TikTok app, where you add a sound/cover and post it yourself.
