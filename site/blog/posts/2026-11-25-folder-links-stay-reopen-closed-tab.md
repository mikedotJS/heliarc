---
title: "Folder links that stay put, and Cmd+Shift+T to reopen a closed tab"
description: "Heliarc 0.5.9 keeps the links in your sidebar folders when you close them, sends them back to the page you saved, reopens closed tabs and lets you undo a deleted folder."
date: 2026-11-25T20:00:00+01:00
version: "0.5.9"
faq:
  - q: "What happens when I close a tab that is in a folder?"
    a: "The page is unloaded and the link stays in its folder, greyed out. Click it to load the page again. Before 0.5.9, closing it removed it from the folder."
  - q: "Which page does a folder link open?"
    a: "The page it showed when you put it in the folder. If you browse elsewhere inside it, closing it, or leaving it for 10 minutes, sends it back to that page. Right-click and choose Back to saved page to do it at once."
  - q: "How do I reopen a tab I just closed?"
    a: "Press Cmd+Shift+T on Mac or Ctrl+Shift+T on Windows. Press it again to go further back, up to the last 25 tabs. The shortcut can be changed in Settings, and the sidebar's right-click menu has Reopen closed tab too."
  - q: "Can I get a deleted folder back?"
    a: "Yes, for 8 seconds. A card with an Undo button appears at the bottom of the sidebar. Undo puts the folder back where it was, with its links inside."
  - q: "Does this apply to the Private space?"
    a: "No. In the Private space, closing a tab still removes it, so nothing from that space is kept."
---
Sidebar folders are where you keep links you want to find again: a reading list, a project, a shopping comparison. Until now, closing one of those tabs removed it from the folder, and the link was gone. Heliarc 0.5.9 treats folder links as saved links, the way Arc does, and adds two safety nets for everything else.

## What changes

- **Closing a folder link keeps it.** The page is unloaded to free memory, the link stays in its folder, greyed out, and one click loads it again.
- **A folder link remembers its page.** It goes back to the page it was saved on when you close it, when you leave it for 10 minutes, or when you right-click it and choose **Back to saved page**. Pinned tabs already worked this way since [0.5.8](/blog/pinned-tabs-return-to-original-page/).
- **Cmd+Shift+T reopens the last closed tab** (Ctrl+Shift+T on Windows). Press it again to go further back, up to 25 tabs.
- **Deleting a folder can be undone.** For 8 seconds, a card at the bottom of the sidebar offers **Undo**.

## How it works

### Close a link in a folder

Close the tab the way you always do: the cross on the tab, Cmd+W, or **Close tab** in its right-click menu. If the tab is in a folder, it stays there and turns grey. If you had wandered off to another page inside it, it is back on the page you saved.

Tabs outside folders close as before.

### Reopen a closed tab

Press Cmd+Shift+T. The tab comes back in the space it was closed in, on the page it showed. Heliarc remembers the last 25 closed tabs while it runs. You can change the shortcut in **Settings > Keyboard shortcuts**, and **Reopen closed tab** is also in the right-click menu of the empty part of the sidebar.

### Undo a deleted folder

When you delete a folder, its links move to the pinned list, as before. A card appears: **"Reading" deleted**, with an **Undo** button. Click Undo within 8 seconds and the folder comes back in its place, with its links inside.

## Who it's for

This is for anyone who uses folders as a reading list or a collection of links, and for anyone who has closed the wrong tab with Cmd+W.

A word of caution: like pinned tabs, a folder link goes back to its saved page after 10 minutes away. Don't leave a half-filled form in one. Use a regular tab for that.

## Try it

Heliarc is free and open source for Mac and Windows. [Download Heliarc](/#download).

Full release notes: https://github.com/mikedotJS/heliarc/releases/tag/v0.5.9
