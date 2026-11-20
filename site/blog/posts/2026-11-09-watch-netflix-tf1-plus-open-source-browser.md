---
title: "Watch Netflix and TF1+ in an open-source browser"
description: "Heliarc now plays protected video like Netflix and TF1+, and hides the turn off your ad blocker warnings. A free, open-source browser for Mac and Windows."
date: 2026-11-09T15:05:10+01:00
version: "0.5.1"
faq:
  - q: "Can I watch Netflix in Heliarc?"
    a: "Yes. Since version 0.5.1 Heliarc plays protected video such as Netflix and TF1+. It runs on castLabs Electron with Widevine, and the Mac and Windows builds are signed so that DRM sites accept them."
  - q: "Why did TF1+ not work with an ad blocker?"
    a: "TF1+ did not play behind the ad blocker. In 0.5.1 Heliarc no longer puts TF1+ behind its ad blocker, so the player works. Other sites keep the protection you chose."
  - q: "How do I hide the turn off your ad blocker message?"
    a: "Open Settings, go to Privacy and turn on Hide turn off your ad blocker warnings. It adds the Adblock Warning Removal List, updated daily, and it is on by default."
  - q: "Does the warning remover work on every site?"
    a: "No. It cannot help when a site puts its ads inside the video itself. For sites you want to see ads on, you can also allow ads for one site from the shield at the bottom of the sidebar."
  - q: "How do I get the update?"
    a: "Heliarc looks for new versions every few hours. In Settings, General, press Check now to look straight away. On Mac it downloads in the background and asks you to restart. On Windows a notice appears in the sidebar."
---
You open a streaming site in a privacy-focused browser, press play, and get a black rectangle or an error. Protected video such as Netflix needs a part of the browser that most small browsers do not ship. Heliarc 0.5.1 adds it, so you can watch Netflix and TF1+ in an open-source browser without switching to another one.

## What it does

Protected video uses DRM, a kind of lock that streaming services put on their videos. To play them, a browser needs a component called Widevine, and the app has to be signed in a way the services accept.

Heliarc now runs on castLabs Electron, which includes Widevine. The Mac and Windows builds are also signed through castLabs EVS, so DRM sites accept them. castLabs Electron is a build of Electron, the engine Heliarc is made with, that ships with Widevine. The sidebar, spaces and extensions you already use are the same. The result is simple: Netflix and TF1+ play, on Mac and on Windows.

This release also deals with a smaller annoyance. Many sites show a message asking you to turn off your ad blocker. Heliarc can now hide those messages.

## How it works

### Play protected video

There is nothing to set up. Update Heliarc, open the streaming site, sign in and press play.

To update, open Settings, stay in **General**, and press **Check now** next to Updates. Heliarc also looks for a new version every few hours. On Mac it downloads the update in the background and asks you to restart. On Windows a notice appears in the sidebar when a newer release is out.

Heliarc's ad and tracker blocker is no longer applied to TF1+. That was the reason its player did not work before. Other sites keep the blocker.

### If a video still does not play

First check your version. In Settings, under **General**, the line about keeping Heliarc up to date shows the version you run. Protected video arrived in 0.5.1, so anything older needs the update.

Then remember why the builds are signed: DRM sites accept a browser only when it is signed. A copy you build yourself from the source code, without castLabs signing credentials, may be refused. Use the release from the download section.

### Hide the ad blocker warnings

1. Open Settings and go to **Privacy**.
2. Find **Hide "turn off your ad blocker" warnings**.
3. Turn it on. It is on by default.

Behind the switch is the Adblock Warning Removal List, which Heliarc updates daily. It hides the messages that ask you to disable your blocker.

It has a limit. If a site puts its ads inside the video itself, a list of page rules cannot help. The setting says so in its description.

### Allow ads on one site

If you want to support a site you like, you do not need to turn the blocker off everywhere. Click the shield at the bottom of the sidebar while you are on that site, and switch off **Ad and tracker blocker** for it. The change reloads the page, and every other site stays protected.

## A concrete scenario

It is Sunday evening and you want to watch an episode. Before this release, you might have kept a second browser just for streaming. Now you open a tab in Heliarc, go to Netflix, and watch it next to your usual tabs. If you switch to TF1+, the player loads there too.

Later you read a site that asks you to turn off your ad blocker. With the warning switch on, the message is hidden and you read the article.

## Who it's for

This is for anyone who likes Heliarc's sidebar and privacy settings but kept another browser around for video. It is also for people who want a browser with Widevine that is free and open source, and that runs on both Mac and Windows.

It is not a way to skip DRM. The services still decide what you can watch, and you still sign in with your own account.

## Also in Heliarc 0.5.1

- **Signed builds.** Mac and Windows builds are now EVS-signed when the release is built. The build pipeline also got a fix so it installs the signing tool with the right interpreter.
- **Privacy stays on.** The warning remover sits next to the ad and tracker blocker, third-party cookie blocking and the rest of the [privacy settings](/#privacy).

If you want to keep a site from eating your evenings, see [the site blocker with schedules](/blog/block-distracting-websites-on-a-schedule/). If you rely on Bitwarden or another password manager, the next small release, covered in [GitHub, GitLab and Touch ID passkeys](/blog/github-gitlab-sidebar-touch-id-passkeys/), smoothed that out too.

## Try it

Heliarc is a free, open-source browser with a tab sidebar, built-in ad and tracker blocking and Chrome extensions. [Download Heliarc](/#download) for Mac and Windows and put Netflix and TF1+ in the same window as everything else.

Full release notes: https://github.com/mikedotJS/heliarc/releases/tag/v0.5.1
