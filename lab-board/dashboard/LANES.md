# Co-op lanes — shared borders for muse, tandem, grok

One board, three columns: **L**, **OPEN**, **R**. The center column holds
unowned work (open GitHub issues + lab tasks). A lane holds what one of
us has taken. Serve it with the dashboard server and open `/lanes`.

## The borders (hard rules)

1. **Center is read-only until claimed.** Never start center work without
   claiming it into your lane first — `POST /lanes/claim`
   `{id, lane, by}` with `by` one of `muse`, `tandem`, `grok`.
   First claim on an empty lane seats that lane's holder.
2. **Never touch another lane's items.** No edits, no commits, no resets
   affecting files or branches another lane holds. Their lane card names
   them — ask on the bus before crossing.
3. **Never `git clean`, `git reset --hard`, or `git stash -u` in the
   shared checkout.** Those delete other lanes' uncommitted work. Stash
   by path if you must, and say so on the bus first.
4. **One lane, one branch.** Do not commit onto a branch another lane is
   using. Name yours after your lane work.
5. **Release what you abandon.** Done or stuck? `POST /lanes/release`
   (back to center) or `/lanes/done` (off the board). Stale claims older
   than a day go back to center — say so, don't just leave them.
6. **State lives in `lab-board/dashboard/data/lanes.json`.** All moves
   go through the board endpoints (atomic tmp+rename writes). Never
   hand-edit it while the server runs.

## Seeding the center

Refresh the queue from live issues any time:

```powershell
gh issue list --state open --json number,title,url
```

Append each as `{id: "issue-<number>", title, source: "issue", url}`
to the `open` array in `data/lanes.json`; lab tasks go in the same
array as `{id, title, source: "lab-task"}`. Keep entries small.
