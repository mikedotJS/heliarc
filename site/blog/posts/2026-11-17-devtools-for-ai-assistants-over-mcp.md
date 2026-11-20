---
title: "Let your AI assistant debug your site with DevTools"
description: "Heliarc gives Claude, Cursor and other MCP apps real DevTools: console, network, styles, storage, phone sizes and Web Vitals. Free for Mac and Windows."
date: 2026-11-17T01:44:51+01:00
version: "0.5.6"
faq:
  - q: "Can an AI assistant use browser DevTools?"
    a: "Yes, in Heliarc. A connected MCP assistant such as Claude Code or Cursor can read the console and the network, run scripts, inspect elements and their CSS, edit storage, emulate a phone or a slow connection, and measure the Web Vitals."
  - q: "How do I turn on DevTools for my AI assistant?"
    a: "Open Settings, go to AI assistants and turn on Let an AI assistant control Heliarc. Copy the command shown there into your assistant, for example Claude Code. The DevTools tools come with the same connection."
  - q: "Can the assistant read my cookies?"
    a: "Only if you allow it. Cookies are shared site by site, and only until Heliarc quits. Without your permission the assistant can still work with the page, but it does not get the cookies."
  - q: "Is it safe to let an AI assistant run scripts in my browser?"
    a: "The connection is local to your computer and protected by a secret token, and the Private space is never reachable. Scripts run as they would in the console, so connect only assistants you trust. You can press New token to cut off every app."
  - q: "Does Ask Heliarc in the command bar get these DevTools?"
    a: "No. The DevTools tools are for assistants you connect over MCP, like Claude Code or Cursor. The built-in Ask Heliarc assistant does not get them."
---
You are fixing a page that looks wrong on a phone, or an API call that fails only on your machine. You describe the problem to an AI assistant, and then you copy console errors and network details into the chat by hand. Heliarc 0.5.6 lets your AI assistant debug your site itself, with the same DevTools you would open, in a real browser.

## What it does

An assistant connected to Heliarc over MCP can now use DevTools. It can:

- read the console, including uncaught errors
- list network requests and open one to see its headers and body
- run a script, as you would in the console
- inspect an element: its HTML, its computed styles and the CSS rules that set them, with file and line
- read and edit localStorage, sessionStorage and cookies
- emulate a phone, a tablet or a given screen size, dark mode, a slow or offline connection and a slower processor
- produce a performance report with the Web Vitals
- take a screenshot of one element or of the whole page
- open the DevTools window for you

Cookies are the exception. They are only shared once you allow it, site by site, and only until Heliarc quits.

## How it works

### Connect your assistant

If you already connected an MCP app to Heliarc, you are done. The DevTools tools come with the same connection.

1. Open Settings and go to **AI assistants**.
2. Turn on **Let an AI assistant control Heliarc**.
3. Copy the command Heliarc shows and run it in your assistant. In Claude Code it starts with `claude mcp add --transport http heliarc`. For other apps, Settings gives the address and the header with the token.
4. Open the page you want to debug and ask.

If the token leaks, press **New token** in the same place. It cuts off every app that used the old one.

### What happens behind the scenes

Heliarc attaches its debugger to a tab only once the assistant inspects it. Until then the tab is left alone. Every DevTools call gives up after 20 seconds instead of waiting forever, so a stuck call cannot freeze the assistant.

That limit has a story. Version 0.5.5 was never published: its Mac build hung on a DevTools call when a hidden or minimized window stopped drawing. The 20-second limit fixed it, and 0.5.6 is the version you get.

### Allow cookies when you need them

If the assistant needs a site's cookies, for example to debug a login, Heliarc asks you first with a dialog: "An AI assistant wants the cookies of" that site. You can choose **Allow until Heliarc quits** or **Deny**. Because cookies can be used to act on a site as you, allow them only when you asked for it.

## A concrete scenario

Your checkout page works on your laptop and breaks for a customer on a phone with a poor connection. You write to your assistant: "Open our checkout page, pretend to be a phone on a slow connection, and tell me what fails."

The assistant switches to phone size and a slow network, reads the console, and finds a script error. It lists the network requests and opens the one that failed to read its response. It looks at the element that is cut off and the CSS rules that set its width, with the file and line. Then it measures the Web Vitals so you have numbers to compare after the fix.

You still decide what to change. The assistant tells you where to look.

## Who it's for

This is for web developers who already use Claude Code, Cursor or another MCP app and are tired of pasting console output into a chat. It is also for people who build and test their own sites and want a second pair of eyes that can open a page, click through it and inspect it.

If you only want to ask a question about a page you are reading, the built-in [Ask Heliarc](/blog/let-ai-assistant-control-your-browser-mcp/) is simpler. It does not get the DevTools tools.

## Also in Heliarc 0.5.6

- **Whole-page screenshots.** A screenshot can cover one element or the full page.
- **Calls that cannot hang.** A hidden or minimized window may stop drawing. A full-page picture used to wait forever for a frame that never came. That wait now ends after 20 seconds.
- **Same safety as before.** The connection still listens only on your computer, needs the secret token, and never reaches the Private space.

The [AI section](/#ai) of the site shows how MCP apps and DevTools fit together.

## Try it

Heliarc is a free, open-source browser with a tab sidebar and built-in ad and tracker blocking. [Download Heliarc](/#download) for Mac and Windows, turn on the assistant switch and let your next bug report come with the console already read.

Full release notes: https://github.com/mikedotJS/heliarc/releases/tag/v0.5.6
