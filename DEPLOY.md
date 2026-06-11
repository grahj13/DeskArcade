# DeskArcade — Vercel + Upstash setup

DeskArcade is a **static site** (HTML/CSS/JS) with a small **Vercel serverless API** for leaderboards. No build step required.

## 1. Push to GitHub

If the repo is not on GitHub yet:

```bash
git init
git add .
git commit -m "DeskArcade initial deploy"
git remote add origin https://github.com/YOUR_USER/DeskArcade.git
git push -u origin main
```

## 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your **DeskArcade** GitHub repository
3. Framework preset: **Other**
4. Build command: leave **empty**
5. Output directory: leave as **/** (root)
6. Click **Deploy**

Vercel will install `package.json` dependencies automatically for the `/api` routes.

Your site will be live at `https://your-project.vercel.app` within a minute.

## 3. Connect DeskArcade.co.uk

1. Vercel project → **Settings** → **Domains**
2. Add `deskarcade.co.uk` and `www.deskarcade.co.uk`
3. Vercel shows DNS records — add them at your domain registrar:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

(Use the exact values Vercel shows — they may differ slightly.)

4. Wait for DNS propagation (often 5–30 minutes, sometimes up to 48h)
5. Vercel will issue HTTPS automatically

## 4. Upstash Redis leaderboard

### Create database

1. Go to [console.upstash.com](https://console.upstash.com) → **Create database**
2. Choose a region close to UK users (e.g. **London** / **eu-west-2**)
3. Name it something like `deskarcade-lb`
4. After creation, open the database → **REST API** tab
5. Copy:
   - **UPSTASH_REDIS_REST_URL**
   - **UPSTASH_REDIS_REST_TOKEN**

### Add env vars to Vercel

1. Vercel project → **Settings** → **Environment Variables**
2. Add both variables for **Production** (and Preview if you want leaderboards on preview deploys):

| Name | Value |
|------|-------|
| `UPSTASH_REDIS_REST_URL` | From Upstash REST API tab |
| `UPSTASH_REDIS_REST_TOKEN` | From Upstash REST API tab |

3. **Redeploy** the project (Deployments → ⋯ → Redeploy) so the API picks up the new vars.

No client-side config file is needed — secrets stay on the server.

### Free tier notes

Upstash free tier includes 10,000 commands/day — plenty for a desk-break arcade. Each score submit uses a handful of Redis commands; reads are cheap.

## 5. How leaderboards work

- Each game has its own **Top 10** board stored in Upstash Redis (sorted sets)
- When a player beats the 10th-place score, they get the classic **3-character name** prompt (`JAS`, `BOB`, `X7K`…)
- Scores are stored as integers; display formatting is handled per game in `assets/leaderboard.js`
- Lower-is-better games (Reacto, Perfect 10, Shockline, Neon Search) store time/diff in **milliseconds**
- API route: `GET /api/leaderboard?game=snake&board=default` and `POST /api/leaderboard`

### Per-game score keys

| Game | Slug | Board key | Better |
|------|------|-----------|--------|
| KeyStorm | `keystorm` | `default` | Higher |
| Grid Viper | `snake` | `default` | Higher |
| Shockline | `shockline` | `easy` / `normal` / `hard` | Lower (time) |
| NeonReels | `neonreels` | `default` | Higher |
| Reacto | `reacto` | `default` | Lower (reaction ms) |
| Perfect 10 | `perfect10` | `default` | Lower (diff ms) |
| Lane Dash | `lanedash` | `default` | Higher |
| Neon Search | `neonsearch` | `default` | Lower (time ms) |
| Fracture | `fracture` | `default` | Higher |
| Signal Scan | `signalscan` | `default` | Higher (round) |
| Word Forge | `wordforge` | `challenge` / `chill` | Higher |
| Run.exe | `runexe` | `default` | Higher |
| Perfect Trace | `perfecttrace` | `square` / `triangle` / `circle` | Higher (%) |
| Pixel Glide | `pixelglide` | `default` | Higher |
| Word Trap | `wordtrap` | `easy` / `normal` / `hard` | Higher |
| Ghost Pixel | `ghostpixel` | `classic` / `sequence` / `grid` | Higher |

## 6. Wiring a game page

Add to the game’s `<head>`:

```html
<link rel="stylesheet" href="../../assets/leaderboard.css">
```

Before `</body>`:

```html
<div id="leaderboard"></div>
<script src="../../assets/leaderboard.js"></script>
<script>
  DeskArcadeLeaderboard.mountPanel(document.getElementById('leaderboard'), 'snake');
</script>
```

On game over / win:

```javascript
await DeskArcadeLeaderboard.trySubmit('snake', score, {
  panel: document.getElementById('leaderboard')
});
```

## 7. Local development

Leaderboards need the Vercel API and Upstash env vars. Options:

- **`vercel dev`** — runs static files + API locally (install Vercel CLI, link project, pull env vars)
- **Preview deploy** — test on a Vercel preview URL after pushing a branch

Opening HTML files directly (`file://`) shows “Leaderboard offline” — expected.

## 8. Office / desktop notes

- Leaderboards are **global** (all visitors compete) — perfect for a public desk-break arcade
- Scores can be spoofed without server validation; fine for casual office fun
- For stricter anti-cheat later: validate game logic in the API before accepting scores

## 9. Existing feedback form

The hub feedback form still uses Google Apps Script — unchanged. Leaderboards are separate (Upstash only).
