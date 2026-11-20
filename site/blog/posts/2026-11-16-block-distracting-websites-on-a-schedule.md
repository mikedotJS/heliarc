---
title: "Block distracting websites on a schedule"
description: "Heliarc, a free browser for Mac and Windows, blocks the sites you choose all day or on a schedule, with a 5-minute pause when you really need one."
date: 2026-11-16T22:17:28+01:00
version: "0.5.4"
faq:
  - q: "How do I block a website in my browser on a schedule?"
    a: "In Heliarc, open Settings and find Blocked sites. Add a site, then switch it from All the time to On a schedule. Pick the days and the start and end times. Outside those hours the site opens normally."
  - q: "Can I block just one part of a site, like YouTube Shorts?"
    a: "Yes. You can block a whole site with its subdomains, or a precise address such as youtube.com/shorts. An address blocks that page and the pages under it."
  - q: "What is the 5-minute pause?"
    a: "When a site is blocked you can press Pause 5 min on the blocked screen, or in Settings. The site opens for five minutes, then it is blocked again. It is there for the one time you really need the site."
  - q: "Do my spaces share the same logins now?"
    a: "On a new install, yes. Work and Fun use Home's profile, so you have the same logins, one copy of each extension and one password manager to sign in to. An existing install keeps separate profiles until you change it in Settings, Spaces."
  - q: "Why do extensions need to know they were installed?"
    a: "Chrome tells an extension when it is installed or started, and many use that to open a welcome page or add right-click menu entries. Heliarc now sends the same signals, so those extensions set themselves up properly."
---
Most people do not lack willpower. They lack a wall between work and the site that opens itself in a new tab. If you want to block distracting websites on a schedule, you usually need an extension or a separate app. Heliarc 0.5.4 builds it in: block the sites you choose, all the time or on set hours, with a short pause when you need one.

## What it does

You give Heliarc a list of sites. When one is blocked, opening it shows a "blocked" screen instead of the page. That is true in every space, in Peek and in the Little window. Pages that were already open follow the rule, and so do in-page moves inside web apps.

Each site is blocked either all the time or on a schedule. A schedule is made of days and a time range, and the range can run overnight. When a range starts or ends, open pages follow.

On the blocked screen, **Pause 5 min** lets you in for five minutes. Then the site is blocked again.

## How it works

### Add a site

1. Open Settings and go to the **Blocked sites** section.
2. Type a site, for example `example.com`, or a precise address such as `youtube.com/shorts`, and press **Block**.

A site name covers the site and its subdomains. An address with a path covers that address and the pages under it.

There are two faster ways. Click the shield at the bottom of the sidebar while you are on the site and press **Block**. Or right-click its tab.

### Set a schedule

1. In the site's row, change the drop-down from **All the time** to **On a schedule**.
2. Click the days you want. They are shown as short day names.
3. Set **Blocked from** and **Blocked until** times.

A new schedule starts as weekdays, 9:00 to 18:00. If you set the end earlier than the start, the block runs overnight. The row tells you where things stand: "blocked now", "paused until" a time, or "not blocked right now".

### Take a break

When you hit a blocked screen, press **Pause 5 min**. You can also do it from the site's row in Settings. When time is up, the row shows **Block again** if you want to end the pause earlier.

## A concrete scenario

You keep drifting to a video site during the work day. You add it to Blocked sites, switch it to **On a schedule**, leave Monday to Friday selected and set 9:00 to 18:00. At 8:55 on Tuesday it still opens. At 9:00 the tab you left open turns into the blocked screen. At 19:00 it opens again.

Once, a colleague sends you a link to a video you need to watch for a meeting. You press **Pause 5 min**, watch it and the block comes back by itself.

## Who it's for

This is for people who know their own habits and want the browser to enforce them. It suits students, remote workers and anyone who has a site they open without thinking. It is also useful if you share a computer and want a site off at certain hours.

If you want a block that you cannot cancel in a weak moment, read [strict mode for scheduled blocks](/blog/strict-site-blocking-and-skip-youtube-sponsors/), which came a few days later. The [focus section](/#focus) lists everything Heliarc does to keep you on task.

## Also in Heliarc 0.5.4

### Spaces share one profile

Spaces are Heliarc's way to keep Home, Work and Fun apart. Until now each space kept its own logins. That meant signing in again, and signing in to a separate password manager, in each one.

Now, on a new install, Work and Fun use Home's profile, as in Arc. You get the same logins, one copy of each extension and one password manager to sign in to. If you want a space to be separate, open Settings, go to the space's section, find **Sign-ins and extensions**, and pick **Its own** instead of **Shared with Home**. Its extensions follow and its open tabs reload in the profile they now use.

An existing install keeps separate profiles until you change it. **Clear everything when I quit** wipes every profile, including the ones a shared space set aside. The [tabs section](/#tabs) of the site covers spaces in general.

### Extensions are told when they start

Chrome tells an extension when it was just installed or when the browser starts. Electron, the engine under Heliarc, does not. Each extension now asks when it starts and hears what Chrome would have said. That means welcome pages open, right-click menu entries appear and a session resumes as the extension expects.

Large Web Store downloads also no longer give up after 30 seconds. They get 5 minutes, because password managers weigh around 20 MB. If a download still times out, you get a clear message. More on [extensions](/#extensions).

## Try it

Heliarc is free and open source, with a tab sidebar, built-in ad and tracker blocking and Chrome extensions. [Download Heliarc](/#download) for Mac and Windows, add the one site you would like to see less of, and set the hours.

Full release notes: https://github.com/mikedotJS/heliarc/releases/tag/v0.5.4
