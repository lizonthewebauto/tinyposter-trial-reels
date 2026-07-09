# When things go wrong

Plain fixes for every known failure. Tell the user what happened in one
short sentence, then do the fix.

## Setup

**"node: command not found" or Node under 20.**
The computer needs Node.js. Send the user to https://nodejs.org, tell
them to pick the LTS button, install, then reopen the terminal or agent.
On Windows, `winget install OpenJS.NodeJS.LTS` also works.

**npm install fails.**
Run it again once (networks hiccup). Still failing: check internet,
check disk space (`df -h` or Windows file explorer). Corporate networks
sometimes block npm; say so plainly.

**First render sits at "Getting the renderer ready".**
The first render downloads a small browser one time. On slow internet
this can take a few minutes. It is not stuck. If a firewall blocks
downloads, the error says so; the user needs to allow it.

## The video

**"This file type is not supported."**
Only mp4, mov, and webm work. Screen recordings and phone videos are
almost always mov or mp4 already. Anything else: ask the user to export
as mp4.

**"The video is only X seconds long."**
It needs at least 6 seconds. Ask for a longer video.

**Video is very long (over 5 minutes).**
It still works, but ask the user which minute is the best part and plan
with `--target 27` so each reel stays short. Rendering a long source is
fine; only the cut parts render.

**"No talking found" (even-cuts message).**
The audio is music-only, silent, or very quiet. The reel still renders
with even slices. Tell the user this in one sentence and keep going.
If they say the video definitely has talking, re-run analyze with
`--silence-noise -45dB`.

**A variant errors under 3 seconds.**
The source is too short or too quiet for the target length. Lower
`--target`, or re-run analyze with `--no-silence-detect`.

## Rendering

**Render crashes or a variant fails.**
Re-run `node scripts/render.mjs --only N` for that variant once. Still
failing: check free disk space. Renders need a few hundred MB.

**A file comes out over 50 MB.**
The render script re-encodes smaller by itself, up to two times. If it
still fails, plan again with a lower `--target` (shorter reel).

**Text looks wrong in the QA pictures.**
Fix the words in `out/plan.json`, then re-render just that variant:
`node scripts/render.mjs --only N`.

## Posting

**Scheduling says upgrade needed (402 / exit 42).**
Expected on the free plan. Reel 1 posts free. Say once: scheduling the
other reels needs a paid plan, from 9 dollars a month, link
https://tinyposter.app/pricing. Offer the fallback: the files are in
`out/` and the user can post one each day by hand. Do not retry.

**Platform not connected (409 / exit 43).**
Send the user to https://tinyposter.app/dashboard to connect Instagram
(or the platform they chose). Wait for them, then try again once.

**Instagram error mentioning 2207078 or "Trial Reel Publish Limit".**
Instagram caps how many trial reels one account can publish per day.
Wait until tomorrow, or post it as a normal reel. Do not retry today.

**Upload fails on a huge file.**
The cap is 50 MB. Rendered variants stay under it by design. If the
user asks to post the original source video instead, check its size
first.

**Token rejected.**
The token must start with `tp_` and come from
https://tinyposter.app/dashboard/tokens. Make a new one if unsure.

**Twitter rejects the video.**
Twitter cuts video at 2 minutes 20 seconds. Trial reel variants are
short, so this only hits custom long targets. Drop Twitter for that
post or shorten the reel.
