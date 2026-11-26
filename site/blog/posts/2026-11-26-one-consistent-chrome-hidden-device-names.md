---
title: "Heliarc no longer looks like a bot, and keeps your device names private"
description: "Heliarc 0.5.11 shows sites one consistent Chrome so bot checks let you through, hides your camera and microphone names until you allow a site, and gives Ask Heliarc the DevTools."
date: 2026-11-26T18:00:00+01:00
version: "0.5.11"
faq:
  - q: "Why did some sites take Heliarc for a bot?"
    a: "Heliarc changed how it described itself inside the page only. The page saw one browser, while its background workers and embedded frames saw another. Anti-bot checks compare them, and a mismatch is what they look for. Heliarc 0.5.11 sets its identity at the source, so every part of the page sees the same browser."
  - q: "Is the hardware masking gone?"
    a: "Yes. Heliarc used to tell pages they ran on 4 cores and 8 GB of memory. The background workers still saw the real values, which made Heliarc easier to spot, not harder. Sites now see your real hardware, as they do in Chrome. The Same hardware as everyone switch is gone from the shield menu."
  - q: "Which sites can see my camera and microphone names?"
    a: "Only the sites you allowed to use your camera or microphone. Before that, a site sees one camera, one microphone and one speaker, without names, exactly as in Chrome."
  - q: "What can Ask Heliarc do with the DevTools?"
    a: "Read the console and the network requests, inspect an element, measure the page speed, switch to a phone view and read what a site stores. Running a script on the page or changing what the site stores asks you first."
---
Some sites decided Heliarc was a bot. A public bot-detection page said so too, while Chrome on the same computer passed. Heliarc 0.5.11 fixes the cause, closes a privacy leak found along the way, and gives the built-in assistant the DevTools.

## One browser, everywhere in the page

To protect you from fingerprinting, Heliarc used to change a few values inside the page: the number of processor cores, the memory, the browser brand. But a page is not one place. It runs background workers and embeds frames from other sites, such as the Cloudflare check, and those kept seeing the real values. Anti-bot systems compare these places on purpose, and a mismatch is exactly what they look for.

Heliarc 0.5.11 sets its identity at the source, for the page, its frames, its workers and its requests. They now all describe the same browser:

- The same Chrome brand and version everywhere, including in frames from other sites.
- Your real processor and memory, as in Chrome. The masking made Heliarc stand out more, not less.
- The same languages in the page and in what it sends to sites.

On the PC used for testing, the public bot check that called Heliarc a bot now says human. Cloudflare's check passes without a click, and the Canal+ and Google sign-ins still work.

The setting in Settings is now called **Look like a plain Chrome**. The **Same hardware as everyone** switch is gone from the shield menu, since there is nothing left to switch per site.

## Your device names stay private

Any site could read the names of your cameras, microphones and speakers without asking, model numbers included. Chrome hides them until you allow a site to use your camera or microphone, and now Heliarc does too. Before that, a site sees one device of each kind with no name. Once you allow it, it sees the full list, and you were asked only once.

Video calls still work as before: a site that has not asked yet does not think your camera is blocked, so Google Meet and others still ask.

## Ask Heliarc can open the DevTools

The built-in assistant used to say it had no access to the DevTools. It now has them: console, network requests, element inspection, page speed, phone view and site storage. Two of them act on the page directly, running a script and changing what a site stores, so they ask you first, with the same card as a risky click.

## Try it

Heliarc is free and open source for Mac and Windows. [Download Heliarc](/#download).

Full release notes: https://github.com/mikedotJS/heliarc/releases/tag/v0.5.11
