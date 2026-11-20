---
name: publish-release
description: Publishes a new Heliarc release (version bump, blog post, tag, CI build, landing blog). Use when the user says "publish", "on publie", "release", "sors une version".
---

# Publish a Heliarc release

Only when the user asked to publish. Everything below happens in `E:\dev\re-helium\app` (Mac: `~/Dev/re-helium/app`, same files).

1. **What ships**: `git log v<last>..HEAD --format="%s%n%b"`. Pick the next version (patch for fixes and small features, minor for a big feature).
2. **Blog post (required: the release workflow fails without it)**: write `site/blog/posts/<YYYY-MM-DD>-<slug>.md`, today's date, slug in keyword-rich kebab-case without the version. Copy the front matter shape of an existing post: `title` (benefit or problem solved, not the version, at most 60 characters), `description` (140 to 160 characters, a short ad for the search result), `date` (ISO with timezone), `version: "x.y.z"`, `faq` (5 questions a searcher would type, answers of 2 to 4 sentences, true to the body).
   Body, 800 to 1,300 words: no H1 (the template renders the title); open with 2 or 3 sentences framing the problem for someone who has never heard of Heliarc, main keyword in the first 60 words; then `##` sections: what it does, how it works (exact UI labels from `ui/panel.html`), one concrete scenario, who it is for, "Also in Heliarc x.y.z"; closing paragraph with a link to `/#download`; 3 to 5 internal links (`/#ai`, `/#focus`, `/#privacy`, `/#extensions`, `/#tabs`, `/#command`, other posts `/blog/<slug>/`); last line links `https://github.com/mikedotJS/heliarc/releases/tag/v<x.y.z>`.
   Facts only from the commits and the code. Plain voice, no em dashes, no hype words (seamless, unlock, elevate, robust, leverage, game-changer).
3. **Check the blog builds**: `npm ci --prefix scripts/blog && node scripts/blog/build.mjs` must print the post count with no error.
4. **Bump and tag**: `npm version x.y.z --no-git-tag-version`, commit `Release x.y.z: <short summary>` with a bullet list of the changes (package.json, package-lock.json and the post together), `git tag vx.y.z`, push main then the tag.
5. **Watch**: `gh run watch` on the "Release vx.y.z" run (blog-post check, 3 builds, release) and the "Landing page" run (publishes the post). Report one line: version live, post URL `https://heliarc.weirdscience.dev/blog/<slug>/`.
