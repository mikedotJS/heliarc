---
title: "Canal+ sign-in works again, and the update button opens on Windows"
description: "Heliarc 0.5.10 fixes the Canal+ sign-in refused with a 403 error, and the update card's Get it button that did nothing on some Windows PCs."
date: 2026-11-26T09:00:00+01:00
version: "0.5.10"
faq:
  - q: "Why did Canal+ refuse to sign me in?"
    a: "Its firewall took Heliarc for a bot. Heliarc presented itself as Google Chrome but with a full version number, which the real Chrome never sends. Heliarc 0.5.10 gives only the major version, as Chrome does, and Canal+ answers it like any Chrome."
  - q: "Does this change anything on other sites?"
    a: "Sites see the same browser as before, with a shorter version number, exactly like Chrome's. Google sign-in and Cloudflare checks still pass."
  - q: "Why did Get it do nothing on Windows?"
    a: "Heliarc asked Windows to open the release page in your default browser. When Windows has no working default browser, nothing opened and no error showed. The release page now opens in a Heliarc tab."
  - q: "How do I install 0.5.10 on Windows if the button does nothing?"
    a: "On 0.5.9 or older, download Heliarc-windows-x64.zip from the release page on GitHub and unzip it over your current copy. From 0.5.10, Get it opens that page for you."
---
Two fixes for things that simply did not work.

## Canal+ sign-in

Signing in to Canal+ ended with a 403 error: the site's firewall refused the request before even checking the password. It took Heliarc for a bot.

The reason was a detail of how Heliarc introduces itself to sites. It says it is Google Chrome, so that sites like Google sign-in accept it. But it also gave its full version number, while the real Chrome only gives its major version (`Chrome/152.0.0.0`). A browser that claims to be Chrome and gives a full version number is not Chrome, and some firewalls know it.

Heliarc 0.5.10 gives only the major version, as Chrome does. Canal+ now answers Heliarc the way it answers Chrome. Google sign-in and Cloudflare checks still pass.

## The update button on Windows

When a new version is out, a card at the bottom of the sidebar offers **Get it**. On some Windows PCs, clicking it did nothing. Heliarc was asking Windows to open the release page in the default browser, and when Windows has no working default browser, the request failed silently.

The release page now opens in a Heliarc tab, where you can download the new version right away.

If you are on 0.5.9 or older on Windows and the button does nothing, download `Heliarc-windows-x64.zip` from the [release page](https://github.com/mikedotJS/heliarc/releases/tag/v0.5.10) and unzip it over your current copy.

## Also in Heliarc 0.5.10

The previous release kept [links in folders when you close them](/blog/folder-links-stay-reopen-closed-tab/) and added Cmd+Shift+T to reopen a closed tab.

## Try it

Heliarc is free and open source for Mac and Windows. [Download Heliarc](/#download).

Full release notes: https://github.com/mikedotJS/heliarc/releases/tag/v0.5.10
