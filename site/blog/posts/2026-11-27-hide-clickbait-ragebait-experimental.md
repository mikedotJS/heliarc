---
title: "Experimental: Heliarc can hide clickbait and ragebait on YouTube, Reddit and X"
description: "Heliarc 0.5.12 adds an experimental filter that fades away videos and posts written to bait clicks or anger, on YouTube, Reddit and X, one switch per site."
date: 2026-11-27T12:00:00+01:00
version: "0.5.12"
faq:
  - q: "How does Heliarc decide what is clickbait or ragebait?"
    a: "It asks Jev, a model from typesafe.ai that answers yes-or-no style questions with a probability. Heliarc sends the titles near your screen in groups and hides a video or post only when Jev is more than 70% sure its title is written to bait clicks or anger."
  - q: "What is sent, and to whom?"
    a: "Only the public titles of videos and posts, and the text of X posts, to Jev, with your own Jev key. Not the page, not your account, and nothing from the Private space. Each title is judged once: Heliarc keeps the verdict on your computer."
  - q: "Does the page wait for the verdict?"
    a: "No. The page shows as usual, and a video or post fades away when its verdict comes back, usually within a second."
  - q: "How do I turn it on?"
    a: "Settings, Experimental. Switch on YouTube, Reddit or X, each on its own, and paste your Jev API key. The key is kept encrypted by your system and never shown again."
---
Some titles are not there to tell you what a video is about. They are there to make you click, or to make you angry enough to stay. Heliarc 0.5.12 can now make them disappear. The feature is experimental and off by default.

## What it does

On YouTube, Reddit and X, Heliarc looks at the videos and posts near your screen and asks whether each title is written to bait clicks or provoke outrage. Those that are fade away, and the rest of the page closes up around them.

The page loads as usual: nothing waits for the verdict. A title Heliarc has already judged is hidden at once the next time you see it.

On a YouTube search for iPhone reviews, it hid titles like "iPhone 18 Pro Max vs 14 Pro Max - SHOCKING" and "it's OVER for iPhone Duo.. (the truth)", and kept "iPhone 17 Pro Review: Paradox in a Box!" and "Actual Customer iPhone Duo Review".

## One switch per site

In Settings, the new Experimental section has a switch for YouTube, one for Reddit and one for X. Turn on only the sites you want.

## Your key, your titles

The verdicts come from Jev, by typesafe.ai, with your own API key. Heliarc sends only public titles and the text of X posts, in groups, never the page or your account, and nothing from the Private space. Each title is judged once and the verdict stays on your computer.

## Experimental means

Some verdicts will be wrong: a catchy title is not always clickbait. Tell us what it hid that it should not have, and we will tune it.

## Try it

Heliarc is free and open source for Mac and Windows. [Download Heliarc](/#download).

Full release notes: https://github.com/mikedotJS/heliarc/releases/tag/v0.5.12
