---
title: "Let an AI assistant control your browser, safely"
description: "Heliarc, a free open-source browser for Mac and Windows, lets Claude or Cursor open tabs and click over MCP, or do it for you from the command bar."
date: 2026-10-30T15:33:52+01:00
version: "0.4.0"
faq:
  - q: "Can an AI assistant control my browser?"
    a: "Yes, in Heliarc. Turn on Let an AI assistant control Heliarc in Settings and an MCP app such as Claude Code or Cursor can open tabs, read pages, click and type. It is off by default, runs on your computer only and needs a secret token."
  - q: "What is MCP in a browser?"
    a: "MCP, the Model Context Protocol, is a standard way for an AI app to use tools. Heliarc offers its browser actions as MCP tools, so an assistant can list your tabs, read a page or click a button instead of asking you to copy and paste."
  - q: "Does the AI see my Private space or my passwords?"
    a: "No to both. The Private space is never reachable by an assistant, and Ask Heliarc never types passwords. Cookies are only read after you allow it, site by site."
  - q: "Do I need an API key to use Ask Heliarc?"
    a: "Yes. Ask Heliarc uses your own Claude API key, which Heliarc keeps encrypted with your system. Your sentence and the pages it reads for that request are sent to Claude, nothing else."
  - q: "Will the assistant click Buy or Delete without asking?"
    a: "No. Ask Heliarc shows a card and waits for you before any click that sends, pays, deletes or publishes. You choose Cancel or Allow this click, and you can press Stop at any time."
---
You can ask an AI assistant to write code or draft an email, but it usually cannot touch the browser where your work lives. Letting an AI assistant control your browser has meant copying text back and forth, or trusting a tool you do not fully understand. Heliarc gives you two ways to do it, and both are off until you switch them on.

## What it does

The first way is for AI apps you already use. Claude Code, Cursor and other apps that speak MCP (the Model Context Protocol) can connect to Heliarc and use your real browser. They can list, open, switch and close tabs, read a page, click, type, scroll and take a screenshot. They can also wait for a piece of text to appear, pick an option in a drop-down, search your history and list your downloads.

The second way is built in. Ask Heliarc lives in the command bar. You type a sentence, and Heliarc does it in your browser with your own Claude API key.

Both run on your computer. The connection for MCP apps only listens on your machine, and every request needs a secret token. Neither can see the Private space.

## How it works

### Connect an MCP app

1. Open Settings and go to the section called **AI assistants**.
2. Turn on **Let an AI assistant control Heliarc**.
3. Heliarc starts its local server and shows a ready-made command. In Claude Code, you copy it with the **Copy** button and paste it in your terminal. It looks like `claude mcp add --transport http heliarc ...` followed by the address and a token.
4. For other apps, Settings also shows the address and the header to use.

Anyone with that command controls your browser, so keep it private. If it leaks, press **New token**. A new token cuts off every app that used the old one.

### Use Ask Heliarc

1. In the same section, turn on **Ask Heliarc, in the command bar**.
2. Paste your Claude API key where it says "Claude API key" and press **Save**. Heliarc checks it, then keeps it encrypted. It is never shown again.
3. Pick a **Model**: Haiku (fastest, cheapest), Sonnet (balanced) or Opus (most careful).
4. Open the command bar with Cmd+L on Mac or Ctrl+L on Windows. Type a sentence and press Tab, or start with `?` and press Enter.

A card appears over the page. It lists each step as it happens, with a Stop button. If you have not added a key yet, the command bar tells you so and opens Settings.

Before any click that sends, pays, deletes or publishes, Heliarc stops and shows what it wants to click and on which site. You pick **Cancel** or **Allow this click**. It never types passwords. Your sentence and the pages it reads for that request go to Claude, and nothing else does.

## A concrete scenario

You have spent an hour on trip research. Twelve tabs are open, some about flights, some about hotels, some about a museum. In Claude Code you write: "Look at my open tabs and put the hotel ones in a folder called Hotels." The assistant lists your tabs and moves the right ones into the folder.

Later you open a long article, press Cmd+L, type `? summarize this page` and get a short answer in the card. You ask a follow-up in the same card, and keep reading.

## Who it's for

This is for people who already work with an AI assistant and want it to act in a real browser, not a throwaway one. It suits developers who use Claude Code or Cursor. It also suits anyone who wants a quick "do this for me" in the address bar, as long as they are happy to use their own Claude API key.

If you prefer to keep AI out of your browser, leave both switches off. Nothing runs and nothing is sent.

## Since 0.5.0: Ask Heliarc knows your page

Version 0.5.0 made Ask Heliarc more useful on a single page.

- **It knows where you are.** Heliarc tells the assistant which page you are on, so "summarize this page" works. The Private space is never shared.
- **Follow-ups keep the conversation.** The card has an "Ask a follow-up" field. Type there and the assistant remembers what came before. Closing the card ends the conversation.
- **Answers are formatted.** Lists, bold text and links show properly. Images, scripts and javascript: links are stripped out.
- **A bug fixed.** The card that asks you to confirm a click never appeared, and the wait was cut at 60 seconds instead of 2 minutes. Both work now.

## Also in Heliarc 0.4.0

- Press `?` alone, or Tab on an empty command bar, and you always get something: a hint row, or Settings if there is no key yet.
- MCP apps got five more tools: wait for text, choose a drop-down option, organize a tab (pin, favorite, sleep, move to a space or folder), search history and list downloads.
- In 0.5.0, MCP page reading and clicking became sturdier on custom controls and scroll areas.

If you want your assistant to go further and debug a web page, read [DevTools for AI assistants](/blog/devtools-for-ai-assistants-over-mcp/). The full list of what assistants can do is on the [AI section](/#ai) of the site, and the command bar is described in [Command](/#command).

## Try it

Heliarc is free and open source. [Download Heliarc](/#download) for Mac and Windows, turn on one switch in Settings, and decide how much your assistant gets to do.

Full release notes: https://github.com/mikedotJS/heliarc/releases/tag/v0.4.0
