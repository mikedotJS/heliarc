---
title: "Pinned tabs that go back to the page you pinned"
description: "Heliarc pinned tabs now remember the exact page you pinned and return to it on demand or after 10 minutes away. Free browser for Mac and Windows."
date: 2026-11-23T11:30:00+01:00
version: "0.5.8"
faq:
  - q: "What is the original page of a pinned tab?"
    a: "It is the exact address the tab showed at the moment you pinned it. Heliarc stores it with the tab. If you browse away inside that tab, the original page stays the same."
  - q: "How do I send a pinned tab back to its original page?"
    a: "Right-click the pinned tab in the sidebar and choose Back to pinned page. The item is greyed out when the tab already shows its original page."
  - q: "When does a pinned tab go back on its own?"
    a: "When you have not been on that tab for 10 minutes. The tab on screen never moves, a tab in split view never moves, and a tab playing sound is left alone. It happens once per time you are away, so you can browse elsewhere in it again after coming back."
  - q: "How do I change the original page of a pinned tab?"
    a: "Unpin the tab, go to the page you want, and pin it again. Unpinning forgets the old address, and pinning stores the address the tab shows at that moment."
  - q: "What happens to tabs I pinned before this update?"
    a: "Each one takes the address it shows when Heliarc 0.5.8 starts as its original page. From then on they behave like newly pinned tabs."
---
A pinned tab is supposed to be a fixed place: your inbox, your calendar, the project board. After a few clicks it is somewhere else, a single email, last month's calendar, a ticket from two weeks ago, and the pin no longer leads where you meant it to. Heliarc 0.5.8 gives every pinned tab an original page and brings the tab back to it, when you ask or after a short time away.

## What it does

When you pin a tab, Heliarc writes down the exact address the tab shows at that moment. That address is the tab's original page. It is not the site's home page. If you pin `https://github.com/notifications?query=is:unread`, that is the page the tab returns to, filters included.

You can then browse freely inside the pinned tab. Open an email, follow a link, go three pages deep. Two things bring it back:

- **On demand**: right-click the tab and choose **Back to pinned page**.
- **On its own**: leave the tab for 10 minutes and it returns to its original page in the background.

The next time you click the pin, you land where you expect.

## How it works

### Pin a tab

Pin a tab the way you already do in Heliarc:

1. Right-click a tab in the sidebar and choose **Pin tab**, or hover the tab and click the pin button.
2. You can also drag the tab into the pinned list, under your favorites at the top of the sidebar.

The address the tab shows at that moment becomes its original page. Pinned tabs live in their own list, they are never archived with the day's unused tabs, and a link to a site you route to another space still opens in place inside them. More on how tabs are organized in [the tabs section](/#tabs).

### Go back on demand

Right-click the pinned tab and choose **Back to pinned page**. The tab loads its original page right away, even if it is not the one on screen. When the tab already shows its original page, the item is greyed out, so the menu also tells you whether you have wandered off.

The item only appears on pinned tabs. Favorites and the tabs of the day keep their usual menu.

### Go back after 10 minutes away

Heliarc checks the pinned tabs once a minute. A pinned tab you have not been on for 10 minutes goes back to its original page. Some cases are left alone on purpose:

- The tab on screen never moves, and neither do the two tabs of a split view. You will not see a page change under your cursor.
- A tab playing sound is left alone, so a podcast or a call keeps going.
- It happens once per time you are away. If the site then redirects to a slightly different address, Heliarc does not reload it again and again. The next time you leave the tab for 10 minutes, it can go back again.

If the tab is hibernated, Heliarc just changes its address, and the original page loads when you open the tab.

### Change the original page

Unpin the tab, go to the page you want, and pin it again. Unpinning forgets the old address. Pinning again stores the new one.

Tabs that were already pinned before the update take the address they show when Heliarc 0.5.8 starts. If one of them sits on the wrong page that day, unpin it and pin it again from the right page.

If you delete a folder, its tabs move into the pinned list as before, and each one keeps the page it shows as its original page.

## A concrete scenario

You keep three pinned tabs in your work space: your inbox, the team calendar on the current week, and a GitHub search for pull requests waiting for your review.

At 9:00 you open an email from a client and click through to a shared document. At 9:05 you check a meeting two weeks ahead in the calendar. Then you work in other tabs for an hour.

When you click the inbox pin again, it shows the inbox, not the client's email. The calendar is back on the current week. The GitHub search still has its filters, because the filters were part of the address when you pinned it. Nothing was closed: the pages you visited are still in the tab's back history if you need them.

In the afternoon you are reading a long issue in the GitHub tab and want to return to the list now, without waiting. Right-click, **Back to pinned page**, done.

## Who it's for

This is for people who use pinned tabs as a dashboard: mail, calendar, chat, a project board, an analytics page with a saved filter. If you have ever clicked a pin and had to find your way back to the page you meant, this removes that step.

It is also for anyone who pins a page with a precise address, a search with filters, a dashboard with a date range, a list sorted a certain way. The pin returns to that exact address, not to the site's front page.

A word of caution: if you leave a half-filled form in a pinned tab for more than 10 minutes, it goes back to its original page and the form is lost. Write long text in a regular tab, or pin the form page itself.

## Also in Heliarc 0.5.8

- The Heliarc website now has a blog, written for each release, with an RSS feed. You are reading it.
- The landing page lists what Heliarc does today: AI assistants, the site blocker with Strict mode, YouTube sponsor skipping, GitHub and GitLab in the sidebar, Touch ID passkeys and protected video. The last release added [strict site blocking and YouTube sponsor skipping](/blog/strict-site-blocking-and-skip-youtube-sponsors/).
- Your AI assistant can still pin and unpin tabs for you over MCP, see [AI in Heliarc](/#ai), and a tab it pins gets an original page like any other.

## Try it

Heliarc is free and open source for Mac and Windows. [Download Heliarc](/#download), pin the three pages you open every morning, and let them find their way back.

Full release notes: https://github.com/mikedotJS/heliarc/releases/tag/v0.5.8
