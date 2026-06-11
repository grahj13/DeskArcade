# DeskArcade — Vercel + Supabase setup

DeskArcade is a **static site** (HTML/CSS/JS). No build step required.

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

## 4. Supabase leaderboard

### Create project

1. [supabase.com](https://supabase.com) → **New project**
2. Choose a region close to UK users (e.g. **London** if available, else **Frankfurt**)
3. Save your database password

### Run the schema

1. Supabase dashboard → **SQL Editor**
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql)
3. Click **Run**

This creates:
- `game_leaderboard_entries` table
- `leaderboard_qualifies()` — checks if a score makes top 10
- `submit_leaderboard_score()` — saves a 3-character name + score

### Get API keys

1. **Project Settings** → **API**
2. Copy:
   - **Project URL** → `supabaseUrl`
   - **anon public** key → `supabaseAnonKey`

### Configure the site

```bash
cp assets/deskarcade-config.example.js assets/deskarcade-config.js
```

Edit `assets/deskarcade-config.js` with your real values.

> `deskarcade-config.js` is gitignored. For Vercel, either:
> - Commit a build step that writes the file from env vars, or
> - Add the file in Vercel’s file tree once (acceptable for anon key + RLS), or
> - Use Vercel **Environment Variables** and a tiny build script (optional upgrade)

Redeploy after adding config.

## 5. How leaderboards work

- Each game has its own **Top 10** board in Supabase
- When a player beats the 10th-place score, they get the classic **3-character name** prompt (`JAS`, `BOB`, `X7K`…)
- Scores are stored as integers; display formatting is handled per game in `assets/leaderboard.js`
- Lower-is-better games (Reacto, Perfect 10, Shockline, Neon Search) store time/diff in **milliseconds**

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
<script src="../../assets/deskarcade-config.js"></script>
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

## 7. Office / desktop notes

- Leaderboards are **global** (all visitors compete) — perfect for a public desk-break arcade
- Scores can be spoofed without server validation; fine for casual office fun
- For stricter anti-cheat later: add Vercel serverless functions that validate game logic before insert

## 8. Existing feedback form

The hub feedback form still uses Google Apps Script — unchanged. Leaderboards are separate (Supabase only).
