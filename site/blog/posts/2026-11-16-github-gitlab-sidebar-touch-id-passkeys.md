---
title: "GitHub and GitLab reviews in your browser sidebar"
description: "See the reviews, issues and CI waiting for you on GitHub and GitLab without opening a tab. Heliarc also adds Touch ID passkeys on Mac. Free, open source."
date: 2026-11-16T15:49:19+01:00
version: "0.5.3"
faq:
  - q: "How do I see my GitHub pull requests in the browser sidebar?"
    a: "In Heliarc, open Settings, find Integrations and connect your account with a personal access token. A card in the sidebar then lists the reviews waiting for you, your own requests with their CI status, issues assigned to you and notifications."
  - q: "Does Heliarc work with GitLab and self-hosted servers?"
    a: "Yes for GitLab, and for GitHub Enterprise. In the Integrations form you can type gitlab.com or your own server for GitLab, and github.com or your Enterprise server for GitHub."
  - q: "Is my access token safe, and can Heliarc change things?"
    a: "The token is checked, then kept encrypted by your system, and it is never shown again. Heliarc only reads your reviews, issues, notifications and CI. It does not change anything on GitHub or GitLab."
  - q: "Can I use Touch ID passkeys in Heliarc on a Mac?"
    a: "Yes. Since version 0.5.3 a Mac can save passkeys with Touch ID. They are kept on that Mac, and a chooser appears when a site has several passkeys for you."
  - q: "Why did Cloudflare's verify you are human check fail before?"
    a: "The check runs in its own frame, which did not look like the page around it. Heliarc now shows that frame the same plain Chrome as the page, so the check passes and Cloudflare sign-ins, its own dashboard included, work again."
---
If you write code for a living, your day starts the same way. You open GitHub, then GitLab, then the notifications page, to find out what is waiting for you. Heliarc 0.5.3 puts your GitHub and GitLab reviews, issues and CI results in the browser sidebar, so you can see them without opening a single tab.

## What it does

You connect a GitHub or GitLab account once. After that, a card in the sidebar tells you how many things are waiting for you. Open it and you get a short list: reviews other people asked you for, your own pull requests or merge requests with their CI result, issues assigned to you, and notifications.

It also adds two shortcuts to the command bar. Type `!gh owner/repo#12` or `!gl group/project!7` and Heliarc jumps straight to that repository, issue or merge request.

The same release brings Touch ID passkeys to Mac and fixes the Cloudflare "verify you are human" check.

## How it works

### Connect an account

1. Open Settings and go to **Integrations**.
2. Pick **GitHub** or **GitLab** in the drop-down.
3. Type the host: `github.com`, or your Enterprise server for GitHub. For GitLab, `gitlab.com` or your own server.
4. Paste a **Personal access token** and press **Connect**.

Heliarc tells you what kind of token to use. For GitLab, a token with the `read_api` permission. For GitHub, a classic token with `repo` and `notifications`, or a fine-grained read-only one. The token is checked, then kept encrypted by your system and never shown again. Heliarc only reads. While Heliarc checks the token, the button reads "Checking…". If a token later expires, the account shows "Token expired or revoked" with a **Reconnect** button. To remove an account, press **Remove** and confirm with **Yes, remove**. Heliarc asks "Remove this account?" first, so a stray click does nothing.

### Read the sidebar card

The card says "N waiting for you", or "Nothing waiting for you" when you are clear. Click it to unfold the list. Each line shows the title, the repository, how long ago it changed and, for your own requests, a small mark for CI passed, failed or running. Click a line and it opens on GitHub or GitLab. The refresh button updates it. The list shows up to eight items and tells you how many more are on the sites.

The card is hidden in the Private space.

### Save a passkey with Touch ID

On a Mac, when a site offers a passkey, you can save it with Touch ID. It stays on that Mac. If a site has several passkeys for you, a chooser lets you pick one.

## A concrete scenario

You sit down at 9:00. The sidebar says "3 waiting for you". You unfold it: one review request from a colleague, one of your merge requests with a red CI mark, and one issue assigned to you. You click the red one first, fix the test, and come back for the rest. You never opened a notifications page.

Later you need a repository on the other service. You press Cmd+L on Mac or Ctrl+L on Windows and type `!gl group/project!7`. You land on the merge request.

## Who it's for

This is for developers who split their day between code hosting and everything else, especially people who use both GitHub and GitLab, for example one for work and one for personal projects. It is also for Mac users who want to try passkeys without installing anything extra.

You do not need to give Heliarc more than read access.

## Also in Heliarc 0.5.3

- **Cloudflare checks pass.** The "verify you are human" check no longer fails. Its frame now sees the same plain Chrome as the page. Sites protected by Cloudflare, its own dashboard included, accept the sign-in again.

## Earlier: Heliarc 0.5.2

A few days earlier, version 0.5.2 fixed a few things people noticed.

- **YouTube shows its player on the first click.** When you clicked a video from a list, the player used to stay blank until you reloaded. It now shows right away.
- **Password managers behave.** With Bitwarden and other manager extensions, the passkey window now closes by itself, and an error inside the extension no longer makes it restart on its own. If you choose "Make this my default password manager", Heliarc stops offering to save your logins. The Passwords page says so and has an **Offer again** button.
- On Windows, the desktop app is found whatever the system language is.

Passwords and extensions are covered in [Bring your extensions](/#extensions). For the tab sidebar these cards live in, see [Your tabs, in order](/#tabs), and for the command bar, [Command](/#command).

## Try it

Your code reviews should not need a browser tab each. [Download Heliarc](/#download) for Mac and Windows, add a token in Settings, and open the sidebar card tomorrow morning. Next in the series: [a site blocker with schedules](/blog/block-distracting-websites-on-a-schedule/).

Full release notes: https://github.com/mikedotJS/heliarc/releases/tag/v0.5.3
