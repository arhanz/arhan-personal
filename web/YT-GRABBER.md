# YT Grabber for arhan.pk

Live at **/projects/yt-grabber** (login required, same accounts as the dashboard).

By default it runs **on your own server** with `yt-dlp` + `ffmpeg`: no FlashData, no bucket, no per-download fees.
Search uses yt-dlp's built-in YouTube search (no scraping of the results page). The old FlashData + bucket route
is still in the code and can be switched on with `YT_PROVIDER=flashdata`.

## Files (all new, nothing existing is changed)

```
src/lib/ytlocal.ts                                    yt-dlp engine: search, job queue, cleanup, limits
src/lib/ytgrabber.ts                                  shared helpers + FlashData fallback
src/app/api/yt-grabber/search/route.ts                POST  one search
src/app/api/yt-grabber/download/route.ts              POST  start one download
src/app/api/yt-grabber/job/[id]/route.ts              GET   job status
src/app/api/yt-grabber/file/[id]/route.ts             GET   streams the finished MP3/MP4 to the person who asked
src/app/(tools)/layout.tsx                            own layout
src/app/(tools)/projects/yt-grabber/{page,Grabber}.tsx, grabber.css
```

Unzip over the project root (replaces the files from the first add-on), then follow the steps below.

## 1. Install the tools on the Linux server (once)

```bash
# yt-dlp: use the official binary (it bundles what YouTube needs and can update itself)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# ffmpeg (makes the MP3s and joins video + audio for MP4)
sudo apt install -y ffmpeg

# JavaScript runtime that YouTube now requires. Deno is the default one yt-dlp looks for:
curl -fsSL https://deno.land/install.sh | sudo DENO_INSTALL=/usr/local sh
#   (alternative: if the server's Node is version 22 or newer, set YT_JS_RUNTIME=node instead of installing Deno)

# check
yt-dlp --version && ffmpeg -version | head -1 && deno --version | head -1
```

**Keep yt-dlp updated.** YouTube changes often and old versions stop working. Add a weekly cron job (`sudo crontab -e`):

```
0 4 * * 1 /usr/local/bin/yt-dlp -U >/dev/null 2>&1
```

## 2. Environment variables (`.env`, all optional)

```env
YT_PROVIDER=local          # local (default) or flashdata
YT_JS_RUNTIME=             # e.g. node (needs Node 22+). Leave empty if Deno is installed.
YT_COOKIES=                # path to a cookies.txt, only if YouTube starts showing "confirm you're not a bot"
YT_PROXY=                  # e.g. http://user:pass@host:port, only if you need to route YouTube through a proxy
YT_DLP_PATH=               # only if yt-dlp is not on the server's PATH
YT_FFMPEG_PATH=            # only if ffmpeg is not on the server's PATH

# limits (defaults shown)
YT_MAX_CONCURRENT=2        # downloads running at once, whole server. Raise only if the CPU can take it.
YT_MAX_SEARCH=3            # searches running at once
YT_MAX_USER_JOBS=5         # queued + running downloads per user
YT_HOURLY_LIMIT=120        # downloads per user per hour
YT_MAX_MINUTES=20          # longest video allowed
YT_MAX_MB=200              # biggest source file allowed
YT_KEEP_MINUTES=20         # finished files stay on disk this long, then are deleted
YT_MAX_STORE_MB=2000       # total size of finished files kept; new jobs wait when full
YT_TMP_DIR=                # where files are written (default: system temp dir / ytg)
```

Make sure the server user running Next.js can run `yt-dlp` and write to the temp folder.

## 3. Run Next.js as ONE process

Jobs are kept in memory, so use a single process (pm2 `fork` mode, not `cluster`; one container, not several).
If the site restarts mid-download, that download shows "not found" and the person presses Retry.
This does not work on serverless hosting (Vercel etc.); it needs your own server.

## How it works

1. Search: `/api/yt-grabber/search` runs `yt-dlp "ytsearchN:your words"` and returns the top results.
2. "Download all": `/api/yt-grabber/download` queues one job per video (max 2 running at once, server-wide).
3. The page polls `/api/yt-grabber/job/{id}`. When it is done, the file comes from `/api/yt-grabber/file/{id}`
   and is saved with the song's name. Only the person who started the job can fetch it.
4. Files are deleted after `YT_KEEP_MINUTES`.

Safety built in: login required; per-user and server-wide limits; yt-dlp runs without your site's secrets in
its environment; only a validated 11-character video id ever reaches yt-dlp; error text from YouTube goes to
the server log, visitors see a short message.

## Reality check before you open it to many customers

- **YouTube often blocks data-center IPs** (the "Sign in to confirm you're not a bot" error). The first fix is cookies
  from a throwaway Google account (`YT_COOKIES`), but accounts used this way can get banned. The next fix is a
  residential proxy (`YT_PROXY`), which costs money per GB. Test from your real server before promising anything.
- **Server load:** each MP3 uses CPU for a minute or less, each video uses more, and everything uses your bandwidth.
  With 1,000 customers you will need to raise `YT_MAX_CONCURRENT` and watch the CPU, or add a bigger server.
- **Rules:** YouTube's terms do not allow downloading except through its own features, and copyrighted music
  belongs to its owners. A public downloader service can draw takedown notices, and hosting providers can suspend
  servers over them. Keep it behind login, think about who may use it, and only download content you have the right to.

## Switching back to FlashData

Set `YT_PROVIDER=flashdata`, then add `FLASHDATA_API_KEY` and the bucket variables
(`YT_STORAGE_TYPE`, `YT_BUCKET`, `YT_REGION`, `YT_ENDPOINT`, `YT_ACCESS_KEY`, `YT_SECRET_KEY`, `YT_PREFIX`).
