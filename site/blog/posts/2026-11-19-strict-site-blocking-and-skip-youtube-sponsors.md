---
title: "Lock distracting sites and skip YouTube sponsors"
description: "Heliarc adds Strict mode so a scheduled site block cannot be undone in a weak moment, and skips YouTube sponsor segments with an Undo. Free for Mac and Windows."
date: 2026-11-19T10:31:56+01:00
version: "0.5.7"
faq:
  - q: "What does Strict mode do for a blocked site?"
    a: "Strict mode applies to a site blocked on a schedule. While it is blocked, you cannot unblock it, pause it or change its schedule. The row in Settings shows when the lock ends, and the Unblock button is disabled until then."
  - q: "How do I skip sponsors on YouTube?"
    a: "In Heliarc, the switch Skip sponsors in YouTube videos in Settings is on by default. Sponsor reads and self-promotion that viewers marked on SponsorBlock are skipped. A small Sponsor skipped notice appears with an Undo button."
  - q: "Can I undo a skipped sponsor segment?"
    a: "Yes. When Heliarc skips a segment, a notice with Undo appears on the player for a few seconds. Press Undo and the video jumps back to where you were."
  - q: "Does SponsorBlock know which video I watch?"
    a: "No. Heliarc asks SponsorBlock with a short code that many videos share, never the one you watch, and picks the right video's segments on your side."
  - q: "Why did Cmd+comma not open Settings on my AZERTY keyboard?"
    a: "On an AZERTY keyboard the comma sits on the M key, and a rule for non-Latin layouts turned the shortcut into Cmd+M. Version 0.5.7 fixes it, so Cmd+comma opens Settings again."
---
You blocked a site because it eats your evenings, and then at 22:00 you open Settings and unblock it. A block that you can cancel in a weak moment is only a suggestion. Heliarc 0.5.7 adds Strict mode, so a scheduled block stays in place until its period ends, and it also skips sponsor segments on YouTube.

## What it does

Strict mode is an option for sites you block on a schedule. While the site is blocked, Heliarc will not let you unblock it, pause it or change its schedule. When the period ends, you can change things again.

The second feature is for YouTube. Sponsor reads and self-promotion that viewers have marked on SponsorBlock are skipped, once each, and a notice lets you undo the jump.

The third is a fix: Cmd+, opens Settings again on AZERTY keyboards.

## How it works

### Turn on Strict mode

1. Open Settings and go to **Blocked sites**.
2. Add a site, or pick one already in the list, and set its drop-down to **On a schedule**.
3. Choose the days and the **Blocked from** and **Blocked until** times.
4. Switch on **Strict**.

The description reads: "While it is blocked, no unblocking, pausing or schedule change until the period ends." The Strict switch only appears for scheduled sites.

When the lock is active, the row says "strict, locked until" followed by the end time, or "the end of the day" when the schedule covers the whole day. The Unblock button and the other controls are greyed out. The Site protections panel, opened from the shield at the bottom of the sidebar, also says "Strict schedule: it can't be unblocked until the period ends". The Pause button is not offered.

Take your time when you set it up. Once the block starts, the setting is out of your hands until it ends. If you want an easier block, leave Strict off: you keep the 5-minute pause. We described the basics in [block distracting websites on a schedule](/blog/block-distracting-websites-on-a-schedule/).

### Skip sponsors on YouTube

1. Open Settings and stay in **General**.
2. Find **Skip sponsors in YouTube videos**. It is on by default.
3. Watch a video as usual.

When a segment that viewers marked as a sponsor read or self-promotion comes up, Heliarc jumps past it. A small "Sponsor skipped" notice appears at the bottom right of the player with an **Undo** button. Press it within a few seconds and you are back where you were. Each segment is skipped once, so if you go back on purpose it plays. Nothing is skipped during YouTube's own ads.

Segments exist only where SponsorBlock viewers have marked them, so not every video has any.

SponsorBlock does not learn what you watch. Heliarc asks with a short code shared by many videos, never the video itself, and finds the right segments on your side.

### Settings on an AZERTY keyboard

On Mac, Cmd+, is the standard way to open Settings. On AZERTY keyboards the comma sits on the M key, and the rule for non-Latin layouts read the shortcut as Cmd+M. It now opens Settings. Every shortcut can also be changed in Settings if you prefer another one.

## A concrete scenario

You are studying for an exam. You block a video site from 18:00 to 23:00, Monday to Friday, with Strict on. At 19:30 you feel the pull and open Settings. The site's row says "strict, locked until 23:00", and the Unblock button does not work. You close the tab and go back to your notes.

On Saturday you watch a long tutorial on YouTube. A sponsor read starts at minute 4 and Heliarc jumps past it. At minute 12 it skips a plug for the creator's other channel. If you did want to hear the sponsor, you press Undo.

## Who it's for

Strict mode is for people who set rules for themselves and want the browser to hold them to it. Think of exam periods, deep work and evenings. If you tend to override your own rules, it is made for you. If you want an escape hatch, use a normal schedule with the pause.

The sponsor skipper is for anyone who watches YouTube tutorials, talks or reviews. The AZERTY fix is for Mac users with an AZERTY keyboard.

## Also in Heliarc 0.5.7

- Strict is set per site, so you can use it for one site and keep a gentler schedule, with the pause, for the others.
- The sponsor switch sits with the other general settings, next to automatic picture-in-picture.
- Both new behaviors are options. Sponsor skipping is one switch, and Strict is one switch per site.

For more on how Heliarc helps you focus, see [the focus section](/#focus). If you use a password manager or other extensions, they work the same way as before, see [extensions](/#extensions).

## Try it

Heliarc is free and open source for Mac and Windows. [Download Heliarc](/#download), set up the one block you keep undoing, and let the rule hold.

Full release notes: https://github.com/mikedotJS/heliarc/releases/tag/v0.5.7
