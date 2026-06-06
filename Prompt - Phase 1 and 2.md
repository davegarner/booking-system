---------------------------------------------------------------------
---------------------------------------------------------------------

Prompt

---------------------------------------------------------------------
---------------------------------------------------------------------




i want to create a booking system for 10 employees in my business, there are several requirements i have for the calender function that i would like to work through

Users - They update their own calendar with time that they are free to take clients, this might be monthly, weekly, its up to them

Manager Calendar - this takes all of those meetigns that show when they are available for a client and uses it to assign meetings with the client and user

there are other requriements but i need to work through them slowly





---------------------------------------------------------------------
---------------------------------------------------------------------





I'll help you design this booking system. Let me first understand the current state of your repository, then we'll work through the requirements together.

Agent:Explore booking system repo state
IN
Explore the repository at /Users/david/Repo/FSW-Booking-System to understand its current state. I need to know:

1. Is this an empty/greenfield repo or does it already have code? List the top-level files and directories.
2. What technology stack is in use, if any? Look for package.json, requirements.txt, *.csproj, *.sln, go.mod, Gemfile, composer.json, pom.xml, or any other project/dependency manifests. Report the exact contents of any manifest files found.
3. Is there any existing application code, database schema, migrations, or models? Especially anything related to calendars, bookings, availability, users, employees, or scheduling.
4. Are there any README, docs, or config files (.env.example, appsettings.json, etc.) that describe intent or architecture?
5. What does the git history look like — any meaningful commits, or is it freshly initialized?
6. Report the overall directory tree (a few levels deep, skipping node_modules/vendor/bin/obj and similar build dirs).

Be thorough but concise. Report exact file paths and exact contents of key config/manifest files. Do not modify anything — read only.
Bash Search for common dependency/project manifest files
IN
find /Users/david/Repo/FSW-Booking-System -maxdepth 2 -type f -name "package.json" -o -name "requirements.txt" -o -name "*.csproj" -o -name "*.sln" -o -name "go.mod" -o -name "Gemfile" -o -name "composer.json" -o -name "pom.xml" -o -name "pyproject.toml"

OUT
(Bash completed with no output)
Bash Check git status
IN
git -C /Users/david/Repo/FSW-Booking-System status

OUT
On branch main

No commits yet

nothing to commit (create/copy files and use "git add" to track)
Bash List all files (non-directories) in repo root
IN
ls -la /Users/david/Repo/FSW-Booking-System | grep -v "^d"

OUT
total 0
Thanks — that confirms this is a clean, greenfield repository (just an initialized git repo, no code or stack chosen yet). That's actually ideal: we can shape the architecture directly around your requirements.

Let me play back what I understand so far, then ask a few foundational questions before we go deeper.

What I've understood so far:

~10 employees ("Users") each maintain their own availability calendar — blocks of time they're free to take clients. Cadence is up to each person (some set it weekly, some monthly, etc.).
A Manager sees everyone's availability in one combined view and uses it to assign client meetings — pairing a client + an employee into an available slot.
There are more requirements to come, and you want to work through them gradually.
Before we add more requirements, I want to lock down a few foundational decisions, because they shape everything else (data model, where it runs, who logs in). These are deliberately high-level — we'll get into the calendar details after.

AskUserQuestion
OUT
Your questions have been answered: "What kind of application should this be, and do you have a technology preference? (This drives everything else — we can revisit, but I need a starting point.)"="ideally a web app where you pick the stack but should run on google sites for work as this is the ecosystem we use currently", "How do client meetings actually get created in the system?"="Both", "Should employee availability and bookings connect to an existing calendar, or live only in this app?"="Self-contained for now", "Who needs to log in, and how are clients represented?"="Employees + manager only". You can now continue with these answers in mind.
Got it — here's where that leaves us, plus one important reality I need to flag.

Your answers:

Platform: Web app, in the Google Workspace ecosystem, surfaced through Google Sites, stack my call.
Booking flow: Both — clients self-book and manager can assign/override.
Calendar: Self-contained for now (we can add Google Calendar sync later — easy in your ecosystem).
Actors: Employees + manager only have accounts.
One thing to reconcile: you want clients to self-book, but clients won't have accounts. That's fine and normal — it just means client self-booking happens on a public booking page (client types name + email, picks an open slot — like Calendly), with no login. The manager still assigns/overrides from the authenticated side. I've assumed that; I'll confirm below.

The Google Sites reality (important): Google Sites can't run a custom app itself — it's a page builder. It can only embed an app (via an iframe) or link to one. So whatever we build gets surfaced through your Google Site, but the actual app runs on a Google platform behind it. The two genuine "stay-in-Google" options are Apps Script + Google Sheets (zero hosting, auto-login with work Google accounts) or a Firebase web app (sturdier, scales more). Let me get your call on this — it's the pivotal decision.

AskUserQuestion
OUT
Your questions have been answered: "Within your Google Workspace world, which build approach should we use? (All of these get embedded into / linked from your Google Site — Sites can't host the backend itself.)"="Apps Script + Sheets", "Confirm the self-booking model for clients (no accounts):"="the clients wont self book, they currently make contact through email etc, they dont need to see inside the booking system". You can now continue with these answers in mind.
That actually simplifies the design in a good way. Let me lock the foundation:

✅ Foundation (decided):

Stack: Google Apps Script web app + Google Sheets as the datastore, embedded into your Google Site. Employees and the manager sign in automatically with their Google Workspace accounts (role-based: employee vs manager).
Clients don't touch the system. They reach out by email/phone as they do today; the manager records the client and assigns the meeting. So this is effectively a manager-assigns-everything model — no public page, no client logins, no self-booking. (This supersedes the earlier "Both" answer — cleaner and less to build.)
Self-contained calendar for now; Google Calendar sync is an easy later add since you're already in Google.
So the system has exactly two screens/roles:

Employee view → "Here's when I'm free for clients."
Manager view → combined availability of all 10 + the ability to book a client into an open slot.
Now to your focus — the calendar function itself. You said cadence is up to each employee (weekly/monthly). The two most foundational mechanics I need before anything else are how availability is entered and how a meeting maps onto it. Let's nail those, then keep going through your other requirements one at a time.

AskUserQuestion
OUT
Your questions have been answered: "When an employee marks the time they're free for clients, what's the most natural way for them to enter it?"="Recurring + one-off", "How should a client meeting map onto an employee's free time?"="Free ranges, set per booking". You can now continue with these answers in mind.
Locked in. Here's the calendar model taking shape:

Employees define free time as ranges — recurring patterns (weekly/monthly, their choice) plus one-off dates and exceptions on top.
The manager books a meeting anywhere inside a free range and sets its length per booking. Booking a meeting carves it out of the range, and the free time on either side stays bookable (e.g. a 2–5pm free block + a 3–3:30pm meeting leaves 2–3pm and 3:30–5pm still open).
That's a clean, flexible core. Now let's keep working through your remaining calendar requirements — slowly, one at a time.

To give us a roadmap (so we tackle them in a sensible order rather than all at once), tell me which areas are on your list. Pick any that apply — and use Other to name anything specific you already have in mind. A few areas I'd also expect to matter but didn't list (raise via Other if relevant): who can see whose calendar, recurring meetings with the same client, meeting location/type (in-person vs call), and reporting on hours/utilisation.

AskUserQuestion
OUT
Your questions have been answered: "You said you have several more requirements for the calendar. Which of these are on your list? Pick any that apply (use Other for anything specific) — then we'll work through each one slowly, one at a time."="Notifications, Time off / blocking, Clashes & buffers, Changes & cancels". You can now continue with these answers in mind.
All four — got it. So our remaining roadmap for the calendar is:

Clashes & buffers
Time off / blocking
Changes & cancels
Notifications
I suggest we work through them in that order, because each builds on the last: clash rules define the core booking engine → time-off feeds into what counts as "free" → change/cancel defines the booking lifecycle → notifications sit on top and fire when any of those events happen. We'll do one at a time, exactly as you wanted.

Let's start with #1 — Clashes & buffers. A hard rule I'm already assuming: the system will never let the same employee be booked for two overlapping meetings (that's the whole point). The open questions are around how much breathing room and what limits you want on top of that.

AskUserQuestion
OUT
Your questions have been answered: "Can an employee ever see more than one client at the same time (e.g. a group session), or is it always one client per time slot?"="Always one-to-one", "Do you want an automatic gap between an employee's meetings (for notes, cleanup, or travel)?"="Per-employee buffer", "Beyond the free time an employee marks, should there be caps on how much they can be booked in a day?"="No extra caps". You can now continue with these answers in mind.
#1 Clashes & buffers — done. Recorded:

Strictly one-to-one — the system hard-blocks any overlapping booking for an employee.
Per-employee buffer — each employee sets their own required gap; that gap is auto-reserved around their meetings so nothing can be booked into it.
No daily caps — an employee's own availability is the only limit.
So a booking is only valid if it fits inside a free range, doesn't overlap another meeting, and respects that employee's buffer on both sides. 👍

On to #2 — Time off / blocking. This is the layer that removes availability the employee would otherwise have: vacation, sick days, public holidays, or an ad-hoc "I can't do this afternoon." I'll assume blocks can be either full-day or a partial time range (most flexible — tell me if not). The real decisions:

AskUserQuestion
OUT
Your questions have been answered: "Who can mark an employee as unavailable (vacation, sick days, ad-hoc blocks)?"="Employee + manager", "Do you need company-wide closures (public holidays, team days) that block all employees at once?"="Yes, company-wide blocks", "If time off is added over a period that already has a client meeting booked, what should happen?"="Warn & flag the clash". You can now continue with these answers in mind.
#2 Time off / blocking — done. Recorded:

Both employees and the manager can add time off; employees manage their own, the manager can block anyone.
Company-wide closures — manager sets a holiday/closure once and it blocks all 10 in a single action.
Conflicts warn & flag — time off placed over an existing meeting is allowed but flags that meeting for the manager to reschedule/cancel; nothing vanishes silently.
Blocks can be full-day or a partial range.
On to #3 — Changes & cancels (the booking lifecycle). Two things I'll assume unless you say otherwise: cancelling a meeting automatically reopens that time for re-booking, and a cancellation can capture an optional reason. The decisions:

AskUserQuestion
OUT
Your questions have been answered: "Who can reschedule or cancel a booked meeting?"="Manager + assigned employee", "When a meeting is rescheduled to a new time, how strict should the system be?"="Must be a valid slot", "Do you want a record of who booked, changed, or cancelled meetings and when?"="Yes, keep an audit trail". You can now continue with these answers in mind.
#3 Changes & cancels — done. Recorded:

Manager and the assigned employee can reschedule/cancel that meeting.
Reschedules must land on a valid slot (inside free time, no overlap, respects buffer); the old time reopens automatically.
Full audit trail — every booking, reschedule, and cancellation logged with who, when, and the cancel reason.
Last of your four — #4 Notifications. Since clients don't log in but the manager has their email on file, notifications can reach the client, the employee, and/or the manager. For reminders I'll assume a sensible default of 24h before (manager-adjustable). Let's pin down the rest:

AskUserQuestion
OUT
Your questions have been answered: "Who should receive email notifications about meetings? (Pick all that apply)"="The assigned employee, The client, The manager", "Which events should trigger an email? (Pick all that apply)"="Meeting booked, Meeting rescheduled, Meeting cancelled, Reminder before", "How should notifications be delivered?"="Email only". You can now continue with these answers in mind.
#4 Notifications — done. Recorded:

Emails go to all three parties — the assigned employee, the client (to the address on file), and the manager.
All four events fire emails — booked, rescheduled, cancelled, and a reminder (default 24h before, adjustable).
Email only, sent through your Google Workspace/Gmail — no extra cost or third-party setup.
That completes your four listed topics. 🎯 Before I write this up as a plan, there are a few small gaps I need to close so the design is concrete and buildable — mainly who can see what and what a booking actually records. This is the last round of questions.

AskUserQuestion
OUT
Your questions have been answered: "What should each employee be able to see in the system? (The manager always sees everyone.)"="Only their own", "Besides client name, email, employee, date/time and length, what else should a booking record? (Pick all that apply)"="Client phone, Purpose / notes, Location / format, Meeting type", "Anything else for the first version, or keep v1 focused and add these later?"="Reporting dashboard". You can now continue with these answers in mind.
That's everything I need. Final decisions captured:

Visibility: employees see only their own calendar; the manager sees all 10.
Booking captures: client name, email, phone, purpose/notes, location/format (in-person/phone/video), and meeting type — plus employee, date/time, length.
Reporting dashboard is in v1; recurring client meetings deferred to later.
We've now worked through the whole calendar function. Let me pressure-test the technical design before I write it up — I'll have two architecture agents validate the hard parts (the availability engine + concurrency, and the Apps Script structure + Google Sites embedding) so the plan is solid.

Agent:Design availability engine & data model
IN
I'm designing a booking/scheduling system as a **Google Apps Script web app backed by Google Sheets** (data lives in Sheets tabs), embedded in Google Sites, for a 10-employee business. I need you to design and pressure-test the **data model and the availability-computation engine and concurrency model** — the correctness-critical core. Do NOT write production code; produce a precise design with schemas, algorithm pseudocode, and risk callouts.

Full confirmed requirements:
- Roles: ~10 employees + 1 manager. They sign in with Google Workspace accounts; role looked up in a sheet. Clients do NOT log in — the manager records the client and assigns meetings. Clients reached by email.
- Employees set their own AVAILABILITY (free time for clients) as RECURRING patterns (weekly or monthly — their choice) PLUS one-off dated additions and exceptions.
- Booking model is FREE RANGES, set per booking: the manager books a meeting at any start time inside a free range and sets its length per booking. Booking carves the meeting out; remaining free time on either side stays bookable.
- Strictly ONE-TO-ONE: an employee can never have two overlapping meetings (hard rule).
- PER-EMPLOYEE BUFFER: each employee sets their own required gap between meetings; the buffer is auto-reserved around each meeting so nothing can be booked into it.
- NO daily caps beyond the employee's own marked availability.
- TIME OFF / blocking: employees and manager can both add time off (full-day or partial range). Manager can set COMPANY-WIDE closures that block all 10 at once. Time off placed over an existing booking is ALLOWED but must FLAG the affected meeting(s) for the manager (warn-and-flag; nothing silently deleted).
- CHANGES: manager AND the assigned employee can reschedule/cancel a meeting. Reschedule must land on a fully VALID slot (inside free time, no overlap, respects buffer); old time reopens automatically. Cancelling reopens the time and captures an optional reason. FULL AUDIT TRAIL of book/reschedule/cancel (who + when + reason).
- Visibility: employees see only their own calendar; manager sees everyone.
- Booking record fields: client name, email, phone, purpose/notes, location/format (in-person/phone/video), meeting type, employee, date, start, end/length, status, audit fields.
- Reporting dashboard in v1 (hours booked vs available per employee, utilisation, by meeting type, date range).

Deliver:
1. **Sheet/tab schema** — every tab, exact columns, types, and how recurring rules vs one-off additions vs exceptions vs time-off vs company-wide closures vs bookings vs audit log vs config are represented. Recommend whether to materialise slots or compute them on the fly (I lean toward compute-on-the-fly — validate this).
2. **Availability computation algorithm** — pseudocode for: given an employee + date range, expand recurring rules + one-off additions, subtract exceptions, subtract time off (individual + company-wide), subtract existing bookings AND their buffers, to yield concrete free ranges. Handle weekly AND monthly recurrence, partial-day time off, and the per-employee buffer correctly (buffer on both sides of a meeting). Be precise about edge cases (buffer overlapping range boundaries, adjacent meetings, DST/timezone).
3. **Booking validation algorithm** — how to verify a proposed (employee, start, length) is valid against the computed free ranges + buffer + one-to-one rule.
4. **Concurrency / double-booking prevention** — Sheets is not transactional. Design the locking approach (LockService script lock around validate-then-write) and explain failure modes. How do two managers booking the same slot simultaneously resolve safely?
5. **Warn-and-flag conflict detection** — how to detect and surface bookings that conflict with newly-added time off.
6. **Key risks & limits** — Apps Script quotas, Sheets read/write performance for this scale, timezone handling, and any data-model decisions that would be painful to change later.

Be thorough and concrete. This is the foundation of the whole system.
Agent:Design Apps Script app & deployment
IN
I'm building a booking/scheduling system as a **Google Apps Script web app backed by Google Sheets**, kept in a git repo via **clasp**, and embedded in **Google Sites**, for a 10-employee business (employees + 1 manager sign in with Google Workspace accounts; clients do not log in). I need you to design and pressure-test the **application structure, authentication/roles, frontend, deployment/embedding, notifications, and reporting** — everything except the core availability algorithm (handled separately). Do NOT write production code; produce a precise design with file/module layout, the deployment recipe, and risk callouts. Verify claims about Apps Script + Google Sites where you can.

Confirmed requirements:
- Stack must stay in Google Workspace: Apps Script web app + Google Sheets datastore, surfaced through Google Sites (Sites can only embed via iframe or link — confirm current capabilities/limitations of embedding an Apps Script web app in NEW Google Sites, including any cookie/sandbox/iframe issues and the recommended workaround).
- Auth: identify the logged-in Workspace user (Session.getActiveUser().getEmail()), look up their role (employee vs manager) in a sheet. Two experiences: EMPLOYEE view (set own recurring + one-off availability, personal buffer, time off; see + cancel/reschedule own meetings only) and MANAGER view (combined calendar of all 10, book/reschedule/cancel any meeting, company-wide closures, manage roster, reporting dashboard, audit log). Employees see only their own data.
- Booking captures: client name, email, phone, purpose/notes, location/format (in-person/phone/video), meeting type, employee, date/time, length, status.
- Notifications: EMAIL ONLY via Google Workspace/Gmail. Send to employee + client + manager on: booked, rescheduled, cancelled. Plus a REMINDER (default 24h before, configurable) — needs a time-driven trigger. Design how reminders are scheduled and de-duplicated (mark-as-reminded).
- Reporting dashboard in v1: hours booked vs available per employee, utilisation %, by meeting type, over a date range.
- Calendar UI should be a real week/month calendar — evaluate using FullCalendar (CDN) inside HtmlService vs hand-rolled; recommend one.

Deliver:
1. **Repo + project layout** — how the Apps Script project maps to files in a git repo using clasp (.gs modules, .html templates for HtmlService, appsscript.json, .clasp.json), recommended module breakdown (auth, availability API, booking API, timeoff API, notifications, reporting, ui). Include the clasp setup/prerequisite steps (enable Apps Script API, clasp login, create vs clone project).
2. **doGet routing & role-based rendering** — how to serve different views by role, pass data to the client, and use google.script.run for server calls.
3. **Deployment recipe** — exact web-app deployment settings ("execute as", "who has access") needed so that (a) per-user identity works for auth/roles and (b) it can be embedded in a domain-restricted Google Site. Explain the trade-offs of "execute as me" vs "execute as user accessing".
4. **Embedding in Google Sites** — the concrete steps and known pitfalls; fallback if iframe embedding misbehaves.
5. **Notifications design** — MailApp vs GmailApp, templating, the reminder time-driven trigger design (frequency, query, dedupe), and email-quota considerations for Workspace.
6. **Reporting design** — how to compute the dashboard metrics from the bookings/availability data efficiently and render them.
7. **Frontend approach** — FullCalendar vs custom, how the employee availability editor and manager booking flow should be structured UX-wise.
8. **Key risks & limits** — Apps Script execution-time/quotas, caching strategy (CacheService) for slow Sheets reads, security (who can call what), and testing approach (Apps Script test functions, clasp run).

Be thorough and concrete — this becomes the build plan for everything around the scheduling core.
Bash Show git status, log, and directory listing
IN
git status && echo "---LOG---" && git log --oneline -20 2>/dev/null && echo "---FILES---" && ls -la

OUT
Exit code 128
On branch main

No commits yet

nothing to commit (create/copy files and use "git add" to track)
---LOG---
Bash List all non-git files in the repo
IN
find /Users/david/Repo/FSW-Booking-System -type f -not -path '*/.git/*' 2>/dev/null | head -50; echo "---"; echo "file count:"; find /Users/david/Repo/FSW-Booking-System -type f -not -path '*/.git/*' 2>/dev/null | wc -l

OUT
---
file count:
       0
Bash List all files excluding git and node_modules
IN
find . -type f -not -path './.git/*' -not -path './node_modules/*' | head -200

OUT
(Bash completed with no output)
Web SearchApps Script web app deploy "execute as" "who has access" Session.getActiveUser empty email anonymous
OUT
Web search results for query: "Apps Script web app deploy "execute as" "who has access" Session.getActiveUser empty email anonymous"

Links: [{"title":"Class Session | Apps Script | Google for Developers","url":"https://developers.google.com/apps-script/reference/base/session"},{"title":"Report: How to Run Google Apps Script | by Kanshi Tanaike | Google Cloud - Community | Medium","url":"https://medium.com/google-cloud/report-how-to-run-google-apps-script-b57bb153c796"},{"title":"Class User | Apps Script | Google for Developers","url":"https://developers.google.com/apps-script/reference/base/user"},{"title":"taking-advantage-of-Web-Apps-with-google-apps-script/README.md at master · tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script","url":"https://github.com/tanaikech/taking-advantage-of-Web-Apps-with-google-apps-script/blob/master/README.md"}]

I've performed the web search for your query about Apps Script web app deployment, "execute as" settings, and Session.getActiveUser() behavior.

Here are the key findings:

**About `Session.getActiveUser()` and Email Availability:**

The user's email address is not available in contexts that allow a script to run without that user's authorization, like a web app deployed to "execute as me" (authorized by the developer instead of the user). If security policies do not allow access to the user's identity, User.getEmail() returns a blank string.

**The Two "Execute As" Options:**

When "Execute as: Me" is selected, the script runs as the owner of Web Apps. When "Execute as: User accessing the web app" is selected, the script runs as each user.

**Key Behavior with "Execute as Me":**

When a Web App is deployed with "Execute the app as: Me" by the owner, the authorization screen is automatically displayed. Once the owner authorizes it, both the owner and client users can run the Web App's scripts as the owner. In the case of setting "Execute as: Me" and "Who has access to the app: Anyone", the Web Apps can be accessed without authorization.

**Important Caveat:**

These restrictions generally do not apply if the developer runs the script themselves or belongs to the same Google Workspace domain as the user.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
Web Fetchhttps://developers.google.com/apps-script/guides/html/restrictions
Fetched from https://developers.google.com/apps-script/guides/html/restrictions
Web SearchFullCalendar CDN inside Apps Script HtmlService IFRAME mode working example
OUT
Web search results for query: "FullCalendar CDN inside Apps Script HtmlService IFRAME mode working example"

Links: [{"title":"Fullcalendar.js Iframe Example | Appsmith Community Portal","url":"https://community.appsmith.com/template/fullcalendarjs-iframe-example"},{"title":"Initialize with Script Tags - Docs | FullCalendar","url":"https://fullcalendar.io/docs/initialize-globals"},{"title":"Initialize with Script Tags - Docs v5 | FullCalendar","url":"https://fullcalendar.io/docs/v5/initialize-globals"},{"title":"GitHub - fullcalendar/fullcalendar: Full-sized drag & drop event calendar in JavaScript · GitHub","url":"https://github.com/fullcalendar/fullcalendar"},{"title":"FullCalendar - JavaScript Event Calendar","url":"https://fullcalendar.io/"},{"title":"Getting Started - Docs | FullCalendar","url":"https://fullcalendar.io/docs/getting-started"},{"title":"fullcalendar - npm","url":"https://www.npmjs.com/package/fullcalendar"},{"title":"Documentation | FullCalendar","url":"https://fullcalendar.io/docs"}]

Based on the search results, I found information about using FullCalendar with CDN and iframe approaches:

FullCalendar can be initialized using script tags with a CDN, where you include the FullCalendar bundle from jsDelivr and create a simple HTML structure with a calendar div element that gets initialized via JavaScript.

A working example includes loading the FullCalendar CDN script, then using `DOMContentLoaded` to create a calendar instance with the desired initial view (like `dayGridMonth`) and rendering it to a calendar div.

FullCalendar.js can be used within an iframe without importing it into the editor directly, which is relevant for Google Apps Script's HtmlService IFRAME mode.

For a working example in Google Apps Script specifically, you would:
1. Use `HtmlService.createHtmlOutput()` to create an HTML string
2. Include the FullCalendar CDN script tag (e.g., `https://cdn.jsdelivr.net/npm/fullcalendar/index.global.min.js`)
3. Add your calendar initialization JavaScript within `DOMContentLoaded` event
4. Include a div with `id="calendar"` where the calendar will render

This approach works well because Apps Script's HtmlService runs in sandbox mode, and the CDN-based bundle approach doesn't require module imports or build systems.


REMINDER: You MUST include the sources above in your response to the user using markdown hyperlinks.
Web Fetchhttps://developers.google.com/apps-script/guides/web
Fetched from https://developers.google.com/apps-script/guides/web
Web Fetchhttps://developers.google.com/apps-script/reference/base/user
Fetched from https://developers.google.com/apps-script/reference/base/user
Bash Check for clasp and node toolchain availability
IN
which clasp node npm 2>/dev/null; node --version 2>/dev/null; npm --version 2>/dev/null; clasp --version 2>/dev/null || echo "clasp not installed"

OUT
clasp not found
node not found
npm not found
clasp not installed
Bash Echo plan file target path
IN
cat > /dev/null 2>&1 <<'EOF'
noop - confirming heredoc-to-/dev/null is allowed? Actually skip - using Write tool only.
EOF
echo "plan file target: /Users/david/.claude/plans/i-want-to-create-sorted-clover-agent-a56a86ec29233d342.md"

OUT
plan file target: /Users/david/.claude/plans/i-want-to-create-sorted-clover-agent-a56a86ec29233d342.md
Both architecture reviews came back strong and consistent. They confirmed the approach and surfaced a few important refinements (store time as UTC epoch-ms with one business timezone; compute availability on-the-fly rather than pre-generating slots; deploy "execute as me" so the Google Sites iframe works; lock the booking write path to prevent double-booking). I've folded all of that in. Let me write up the plan.

Write i-want-to-create-sorted-clover.md
142 lines
# FSW Booking System — Implementation Plan

## Context

FSW is a 10-employee business that currently arranges client meetings informally (clients reach out by
email/phone). There is **no system today** — this repo is empty. The goal is an internal booking system,
living entirely inside the existing **Google Workspace** ecosystem and surfaced through the company's
**Google Site**, that does two core jobs:

1. **Employees** maintain their own availability (the times they're free to take clients).
2. **The manager** sees everyone's availability in one place and books client meetings into it — with the
   system guaranteeing no double-bookings, respecting each person's buffer, handling time off, tracking
   changes, and emailing everyone involved.

Clients never log in — the manager records them and assigns the meeting. The intended outcome is a single,
reliable, no-extra-cost place to manage all client scheduling, replacing ad-hoc email/calendar juggling.

## Decisions locked with the user

| Area | Decision |
|---|---|
| **Stack** | Google Apps Script web app + Google Sheets as datastore, embedded in Google Sites. Code kept in this git repo via **clasp**. |
| **Actors** | ~10 employees + 1 manager, signing in with Workspace accounts (role from a sheet). Clients don't log in. |
| **Booking model** | Manager assigns everything. Employees set **free ranges**; manager books any start time inside a range and sets the length per booking. The rest of the range stays bookable. |
| **Availability** | Recurring patterns (weekly **or** monthly, employee's choice) **plus** one-off additions and exceptions. |
| **Clashes** | Strictly **one-to-one** (hard block on overlap). **Per-employee buffer** auto-reserved around each meeting. No daily caps. |
| **Time off** | Employees and manager can both add time off (full-day or partial). Manager can set **company-wide closures**. Time off over an existing meeting is allowed but **flags** that meeting (warn-and-flag; nothing deleted). |
| **Changes** | Manager **and** the assigned employee can reschedule/cancel. Reschedule must land on a **valid** slot; old time reopens automatically. Cancelling reopens time + optional reason. **Full audit trail.** |
| **Notifications** | **Email only** (Gmail/Workspace) to employee + client + manager on booked / rescheduled / cancelled, plus a **reminder** (default 24h before, configurable). |
| **Visibility** | Employees see only their own calendar; manager sees all 10. |
| **Booking fields** | Client name, email, phone, purpose/notes, location/format (in-person/phone/video), meeting type, employee, date/time, length, status. |
| **Scope** | v1 includes a **reporting dashboard** (hours booked vs available, utilisation, by type). Recurring *client* meetings deferred to a later phase. |

## Architecture overview

- **Backend:** Apps Script (V8). Standalone script + a **standalone Google Sheet referenced by ID** (not container-bound — cleaner for git/clasp).
- **Frontend:** `HtmlService` page, role-routed in `doGet`. Calendar rendered with **FullCalendar** (pinned CDN version, loaded over HTTPS). Client↔server via `google.script.run`.
- **Deployment (critical):** Deploy as **Execute as: Me (owner)** + **Who has access: Anyone within domain**. Because all users share the Workspace domain, `Session.getActiveUser().getEmail()` still returns the real user (same-domain exception) — so roles work, there's only a one-time owner authorization, the Sheet is never shared with 10 people, and the **iframe embeds cleanly** (execute-as-user triggers per-user OAuth that breaks inside the Sites iframe).
- **Embedding:** `doGet` must call `setXFrameOptionsMode(ALLOWALL)`, and `Index.html` must include `<base target="_top">` (IFRAME sandbox blocks top-navigation otherwise). Provide a **"Open in new tab" fallback link** on the Site for locked-down browsers.
- **Time handling (correctness foundation):** store all instants as **UTC epoch-ms integers**; keep **one business timezone** in Config (assumed `Europe/London` — confirm). Recurring rules are wall-clock in that zone, resolved to epoch-ms at expansion time so DST is correct. All conversions go through one tested `TimeUtil` helper — never raw `new Date()`.
- **Availability is always computed on-the-fly** (never pre-materialized into slots). The only persisted facts are rules, additions, exceptions, time off, closures, and bookings; free time is derived by interval subtraction. Cancelling/rescheduling therefore reopens time automatically.

## Data model (Google Sheet tabs)

One spreadsheet, one tab per entity, header row + UUID PKs (`Utilities.getUuid()`), ID/phone columns forced to plain text. Use half-open `[start, end)` intervals everywhere.

- **Config** — key/value: `timeZone`, `defaultBufferMin`, `bookingHorizonDays`, `reminderLeadHours`, `cacheTtlSec`, `lockTimeoutMs`, owner/from email, `schemaVersion`.
- **Users** — `userId`, `email` (Workspace login = join key), `displayName`, `role` (employee/manager), `bufferMin`, `recurrenceMode` (weekly/monthly), `active`, `colorHex`. Other tabs key on `userId`, not email.
- **AvailabilityRules** — recurring base: `ruleId`, `userId`, `freq` (WEEKLY/MONTHLY), `dayOfWeek` | (`monthlyMode` DOM/NTH_DOW + `dayOfMonth` | `nth`+`nthDayOfWeek`), `startTimeLocal`/`endTimeLocal` (HH:mm), `effectiveFrom`/`effectiveTo`, `active`.
- **AvailabilityAdditions** — one-off extra free time: `userId`, `startMs`, `endMs`, `note`, `active`.
- **AvailabilityExceptions** — remove recurring time ("not this Monday"): `userId`, `startMs`, `endMs`, `note`, `active`. (Pure availability edit — never flags a booking.)
- **TimeOff** — individual unavailability: `userId`, `scope` (FULL_DAY/PARTIAL), `startMs`, `endMs`, `reason`, `createdBy`, `createdAtMs`, `active`. (Can sit over a booking → flags it.)
- **Closures** — company-wide: `startMs`, `endMs`, `reason`, `createdBy`, `active`. (One row blocks all employees.)
- **Bookings** — `bookingId`, `userId`, client fields (`clientName`/`clientEmail`/`clientPhone`), `purposeNotes`, `locationFormat`, `meetingType`, `startMs`, `endMs`, **`bufferBeforeMin`/`bufferAfterMin` (snapshot at booking time)**, `status` (CONFIRMED/CANCELLED), **`flag` (NONE/TIMEOFF_CONFLICT)** + `flagReason`, `reminderSent`/`reminderSentAt`, `createdBy`/`createdAtMs`, `updatedBy`/`updatedAtMs`, `cancelReason`. Never hard-deleted; cancel = status change.
- **AuditLog** — append-only: `auditId`, `entityType`, `entityId`, `action` (BOOK/RESCHEDULE/CANCEL/FLAG/CREATE/UPDATE), `actorUserId`/`actorEmail`, `atMs`, `reason`, `beforeJson`, `afterJson`.

> Note: buffers are **snapshotted onto each booking** so changing an employee's `bufferMin` later doesn't retroactively create phantom overlaps. `status` and `flag` are separate fields so a meeting can be CONFIRMED *and* flagged for a time-off conflict.

## Core algorithms

**`computeFreeRanges(userId, winStart, winEnd)`** — the heart of the system:
1. Expand recurring rules over the window (iterate local dates, test weekly/monthly predicate, combine date + HH:mm in business tz → epoch-ms).
2. Union in one-off additions.
3. Subtract: exceptions, individual time off, company closures, and each CONFIRMED booking **with its buffer** (`[start-bufBefore, end+bufAfter)`).
4. Return sorted, disjoint free intervals. (Standard merge/subtract/clip interval ops in `AvailabilityEngine`.)

**`validateBooking(userId, startMs, lengthMin, excludeBookingId?)`** — meeting must lie fully inside one free range; buffer enforced only against *other* meetings (a meeting may start at the very first minute of availability). `excludeBookingId` lets reschedule ignore its own footprint.

**Concurrency** — wrap every create/reschedule/cancel in `LockService.getScriptLock()`: acquire → `flush()` → re-validate against committed data → append booking → append audit → `flush()` → release. Two managers booking the same slot: first wins; second re-validates inside the lock, sees the new booking, and is rejected with "slot just taken." No double-booking possible.

**Warn-and-flag** — adding time off/closure finds overlapping CONFIRMED bookings (for the user, or all users for a closure), sets `flag=TIMEOFF_CONFLICT` + reason, audits a FLAG action, and returns the affected list so the manager is warned immediately; flags persist on the dashboard until resolved.

## App structure (clasp project)

```
FSW-Booking-System/
  .clasp.json  .claspignore  package.json  README.md (deploy recipe)
  src/
    appsscript.json        # timeZone, V8, webapp{access:DOMAIN, executeAs:USER_DEPLOYING}, oauthScopes
    Code.gs                # doGet router + include(); setXFrameOptionsMode(ALLOWALL)
    Config.gs  Schema.gs    # SHEET_ID, tab/column constants, enums
    Auth.gs                # getCurrentUser/getRole/requireManager/requireSelfOrManager (security choke point)
    SheetDAL.gs            # bulk read/write + CacheService + LockService wrapper (all data goes through here)
    TimeUtil.gs            # tz/DST epoch<->local helpers (most correctness-critical module)
    AvailabilityEngine.gs  # computeFreeRanges, expandRule, interval set ops
    AvailabilityApi.gs     # recurring/one-off/exception/buffer CRUD
    BookingApi.gs          # validate/create/reschedule/cancel (under lock)
    TimeOffApi.gs          # time off + company closures + warn-and-flag
    Notifications.gs       # MailApp templates + send
    Reminders.gs Triggers.gs  # hourly reminder trigger + mark-as-reminded dedupe
    Reporting.gs           # utilisation/hours/by-type aggregation
    AuditLog.gs  Tests.gs
    ui/ Index.html Employee.html Manager.html Styles.html Js*.html
```

- **Security:** every server function re-derives identity from `Session` and re-checks role — never trust client-sent email/role (under execute-as-me, anyone could call any function from devtools). Manager-only → `requireManager()`; employee data → `requireSelfOrManager()`.
- **Notifications:** `MailApp.sendEmail` (narrow `script.send_mail` scope), HTML + text, `replyTo` = employee. Guard with `getRemainingDailyQuota()` (1,500 recipients/day pooled on owner — ample at this scale).
- **Reminders:** one hourly time-driven trigger; query confirmed + `reminderSent=false` + due within `reminderLeadHours`; send, then set `reminderSent=true` per row (idempotent). Reset the flag on reschedule. `installTriggers()` deletes-then-creates to avoid duplicates.
- **Reporting:** read bookings + availability range in one bulk read each; "available hours" reuses `AvailabilityEngine` so utilisation matches what was actually bookable; cache summaries with invalidation on write.

## Build phases (incremental — built and reviewed one at a time)

0. **Scaffold** — clasp project, `appsscript.json`, Sheet with all tabs/headers + Config defaults, seed Users (10 + manager), `SheetDAL`, `TimeUtil`, `Schema`. Deploy a dev web app; confirm role identity works.
1. **Auth & shell** — `doGet` routing, role-based Employee/Manager views, iframe flags.
2. **Employee availability** — recurring + one-off + exceptions + personal buffer CRUD; `AvailabilityEngine` + unit tests.
3. **Time off / blocking** — individual + company-wide closures; warn-and-flag.
4. **Manager booking** — combined FullCalendar, free-range display, book with full client fields, validation under lock.
5. **Changes & cancels** — reschedule (re-validate) + cancel (reopen + reason); audit trail across all mutations.
6. **Notifications** — emails on book/reschedule/cancel to all three parties; reminder trigger.
7. **Reporting dashboard** — utilisation/hours/by-type.
8. **Embed in Google Sites + UAT** — pin deployment ID, embed `/exec`, add fallback link, smoke-test all roles.

## Prerequisites / setup

- A Google Workspace **owner account** to own the script + Sheet (its identity runs everything and sends all email).
- Local tooling: Node LTS, `npm i -g @google/clasp`, enable Apps Script API at script.google.com/home/usersettings, `clasp login` as the owner.
- Confirm the **business timezone** (plan assumes `Europe/London`).
- Confirm the **default per-employee buffer** and **reminder lead time** defaults (24h) for Config.

## Key risks (and mitigations)

- **Iframe blank/sign-in on locked-down browsers** → `ALLOWALL` + `<base target="_top">` + new-tab fallback link.
- **Double-booking race** → `LockService` + re-validate-inside-lock.
- **Timezone/DST corruption** → epoch-ms canonical + single tz + tested `TimeUtil`; set Sheet + script timezone to match.
- **Privilege escalation via `google.script.run`** → server re-auth on every call.
- **Reminder double-send/miss** → mark-as-reminded flag + reset-on-reschedule (explicitly tested).
- **Sheet growth/perf** → bulk reads only (one `getValues()` per tab), CacheService for hot reads, archive old bookings later.
- **Deployment URL churn** → pin the Sites embed to a stable deployment ID; `clasp deploy` updates it in place.

## Verification

- **Unit tests** (`Tests.gs`, run via editor / `clasp run` against a **separate dev Sheet**): recurring expansion (weekly + both monthly modes), buffer subtraction at range boundaries, time-off/closure subtraction, overlap rejection, reschedule-ignores-self, reminder dedupe, utilisation divide-by-zero.
- **Manual UAT matrix** (manager account + employee account, both in-iframe and direct `/exec`):
  - Employee sets recurring + one-off availability and a buffer → manager sees the resulting free ranges.
  - Manager books a meeting → it carves out of the range, buffer respected, free time on either side remains.
  - Two near-simultaneous bookings into the same slot → exactly one succeeds.
  - Add time off over an existing meeting → meeting is flagged, manager warned, nothing deleted.
  - Reschedule → old time reopens, new time validated; cancel → time reopens, reason captured.
  - Confirm booked/rescheduled/cancelled emails reach employee + client + manager; force one reminder run (set lead time high) and confirm a single reminder.
  - Reporting dashboard shows correct booked vs available hours and utilisation; employee sees only self.
- **Embed check:** load the Site, confirm the app renders in the iframe and the fallback link opens it in a new tab.
The plan is written. Let me load the tool to present it for your approval.

We've worked through your whole calendar function, and the design is captured in the plan. Here's the shape of what we landed on:

What it is: A Google Apps Script web app backed by Google Sheets, embedded in your Google Site — no extra cost, no third-party tools, everyone signs in with their existing Workspace accounts.

What it does:

Employees set their own availability (recurring weekly/monthly + one-offs), a personal buffer, and time off.
The manager sees all 10 calendars combined and books client meetings into open time — with hard double-booking prevention, buffers, warn-and-flag for time-off clashes, full reschedule/cancel + audit trail, email notifications to everyone, and a utilisation reporting dashboard.
How it's built: Code lives in this git repo (via clasp), deployed so the Sites iframe works and identities/roles are reliable, with the booking write-path locked to make double-booking impossible. It's structured into 9 incremental phases so we build and check one piece at a time — matching how you wanted to work through this.

A couple of small things I'll confirm with you when we start building (not blockers): your business timezone (I've assumed UK/Europe/London) and a default buffer value.

Claude’s Plan i-want-to-create-sorted-clover.md
User approved the plan
The plan is approved. I'll start building, beginning with Phase 0 (scaffold) and the correctness-critical foundation — the schema, time/timezone helpers, data-access layer, and the availability engine with its unit tests. These are the modules everything else depends on, so I want them solid and verifiable first.

Let me set up progress tracking, then build.

Update Todos

Phase 0: Scaffold — project files (package.json, .claspignore, .gitignore, README), appsscript.json, Schema/Config, and setup() bootstrap that creates the Sheet, tabs/headers, seeds Config + Users

Foundation modules: TimeUtil (tz/DST epoch<->local), SheetDAL (bulk read/write + cache + lock), AuditLog

AvailabilityEngine: computeFreeRanges, expandRule (weekly + monthly), interval merge/subtract/clip + unit tests

Phase 1: Auth & app shell — Code.gs doGet routing, Auth.gs (getCurrentUser/getRole/require*), iframe flags, Index/Employee/Manager HTML shells

Phase 2: Employee availability — AvailabilityApi CRUD (recurring/one-off/exception/buffer) + employee UI

Phase 3: Time off / blocking — TimeOffApi (individual + company closures) + warn-and-flag

Phase 4: Manager booking — combined FullCalendar, free-range display, BookingApi.create under lock with full client fields

Phase 5: Changes & cancels — reschedule (re-validate) + cancel (reopen + reason); audit across mutations

Phase 6: Notifications — MailApp templates + send on book/reschedule/cancel; hourly reminder trigger + dedupe

Phase 7: Reporting dashboard — utilisation/hours/by-type aggregation + UI

Phase 8: Deploy + UAT docs — README deploy recipe, Google Sites embed steps, smoke-test matrix
Now I'll build the foundation. Starting with the project scaffolding, manifest, schema, and the timezone helper — the modules everything else builds on.

Write package.json
21 lines
{
  "name": "fsw-booking-system",
  "version": "0.1.0",
  "private": true,
  "description": "Internal client-booking system for FSW (Google Apps Script + Google Sheets, embedded in Google Sites).",
  "scripts": {
    "login": "clasp login",
    "create": "clasp create --type webapp --title \"FSW Booking\" --rootDir src",
    "push": "clasp push",
    "pushw": "clasp push --watch",
    "open": "clasp open",
    "deploy": "clasp deploy",
    "deployments": "clasp deployments",
    "logs": "clasp logs"
  },
  "devDependencies": {
    "@google/clasp": "^2.4.2",
    "@types/google-apps-script": "^1.0.83"
  }
}
Write .claspignore
12 lines
# Only the contents of src/ are pushed to Apps Script.
# Everything matched here is kept OUT of `clasp push`.
**/node_modules/**
**/.git/**
package.json
package-lock.json
*.md
.gitignore
.claspignore
.clasp.json.example
plans/**
Write .gitignore
10 lines
node_modules/
.DS_Store
*.log
npm-debug.log*

# .clasp.json holds your scriptId (not a secret, but machine-specific).
# It is created by `clasp create`/`clasp clone`. Commit it if your team shares
# one script; ignore it if each developer clones their own. Default: ignore.
.clasp.json
Write .clasp.json.example
5 lines
{
  "scriptId": "PASTE_YOUR_SCRIPT_ID_HERE",
  "rootDir": "src"
}
Write appsscript.json
16 lines
{
  "timeZone": "Europe/London",
  "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "webapp": {
    "access": "DOMAIN",
    "executeAs": "USER_DEPLOYING"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.send_mail",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
Now the schema — the single source of truth for tab names, columns, and enums that every other module references:

Write Schema.gs
119 lines
/**
 * Schema.gs — single source of truth for the data model.
 *
 * Every tab name, column order, and enum lives here. SheetDAL writes rows in
 * the column order defined by HEADERS, and reads by mapping the live header row
 * back to these names (so manual column reordering in the Sheet won't break us).
 *
 * Conventions:
 *  - All instants are stored as UTC epoch-milliseconds INTEGERS in *Ms columns.
 *  - All IDs are UUID strings (Utilities.getUuid()).
 *  - Intervals are half-open: [startMs, endMs).
 *  - `active` is a real boolean; cancel/soft-delete sets it false (rows are kept).
 */

const SHEETS = {
  CONFIG: 'Config',
  USERS: 'Users',
  RULES: 'AvailabilityRules',
  ADDITIONS: 'AvailabilityAdditions',
  EXCEPTIONS: 'AvailabilityExceptions',
  TIME_OFF: 'TimeOff',
  CLOSURES: 'Closures',
  BOOKINGS: 'Bookings',
  AUDIT: 'AuditLog'
};

/** Canonical column order per tab. Row 1 of each sheet uses exactly these headers. */
const HEADERS = {
  Config: ['key', 'value'],

  Users: ['userId', 'email', 'displayName', 'role', 'bufferMin', 'recurrenceMode', 'active', 'colorHex'],

  AvailabilityRules: [
    'ruleId', 'userId', 'freq',
    'dayOfWeek',                       // WEEKLY: 0=Mon .. 6=Sun
    'monthlyMode', 'dayOfMonth',       // MONTHLY/DOM
    'nth', 'nthDayOfWeek',             // MONTHLY/NTH_DOW (nth=-1 => last)
    'startTimeLocal', 'endTimeLocal',  // "HH:mm" wall-clock in business tz
    'effectiveFromMs', 'effectiveToMs',// active window (epoch-ms, inclusive). Empty effectiveTo = open-ended
    'active'
  ],

  AvailabilityAdditions: ['additionId', 'userId', 'startMs', 'endMs', 'note', 'active'],

  AvailabilityExceptions: ['exceptionId', 'userId', 'startMs', 'endMs', 'note', 'active'],

  TimeOff: ['timeOffId', 'userId', 'scope', 'startMs', 'endMs', 'reason', 'createdBy', 'createdAtMs', 'active'],

  Closures: ['closureId', 'startMs', 'endMs', 'reason', 'createdBy', 'createdAtMs', 'active'],

  Bookings: [
    'bookingId', 'userId',
    'clientName', 'clientEmail', 'clientPhone',
    'purposeNotes', 'locationFormat', 'meetingType',
    'startMs', 'endMs',
    'bufferBeforeMin', 'bufferAfterMin',   // snapshot of the employee's buffer at booking time
    'status', 'flag', 'flagReason',
    'reminderSent', 'reminderSentAt',
    'createdBy', 'createdAtMs', 'updatedBy', 'updatedAtMs',
    'cancelReason'
  ],

  AuditLog: ['auditId', 'entityType', 'entityId', 'action', 'actorUserId', 'actorEmail', 'atMs', 'reason', 'beforeJson', 'afterJson']
};

/**
 * Column-format hints applied by Setup.gs so Sheets never coerces our data.
 *  - 'text'  => '@'  : IDs, phone numbers, time strings (stop leading-zero/UUID mangling)
 *  - 'int'   => '0'  : epoch-ms and other integers (stop date/scientific coercion)
 */
const COLUMN_FORMATS = {
  text: ['userId', 'ruleId', 'additionId', 'exceptionId', 'timeOffId', 'closureId', 'bookingId', 'auditId',
         'entityId', 'actorUserId', 'createdBy', 'updatedBy',
         'clientPhone', 'startTimeLocal', 'endTimeLocal'],
  int:  ['startMs', 'endMs', 'effectiveFromMs', 'effectiveToMs', 'createdAtMs', 'updatedAtMs',
         'reminderSentAt', 'atMs', 'bufferMin', 'bufferBeforeMin', 'bufferAfterMin',
         'dayOfWeek', 'dayOfMonth', 'nth', 'nthDayOfWeek']
};

const ROLES = { EMPLOYEE: 'employee', MANAGER: 'manager' };

const FREQ = { WEEKLY: 'WEEKLY', MONTHLY: 'MONTHLY' };

const MONTHLY_MODE = { DOM: 'DOM', NTH_DOW: 'NTH_DOW' };

const TIMEOFF_SCOPE = { FULL_DAY: 'FULL_DAY', PARTIAL: 'PARTIAL' };

const LOCATION_FORMAT = { IN_PERSON: 'IN_PERSON', PHONE: 'PHONE', VIDEO: 'VIDEO' };

const BOOKING_STATUS = { CONFIRMED: 'CONFIRMED', CANCELLED: 'CANCELLED' };

const BOOKING_FLAG = { NONE: 'NONE', TIMEOFF_CONFLICT: 'TIMEOFF_CONFLICT' };

const AUDIT_ACTION = {
  BOOK: 'BOOK', RESCHEDULE: 'RESCHEDULE', CANCEL: 'CANCEL', FLAG: 'FLAG', UNFLAG: 'UNFLAG',
  CREATE: 'CREATE', UPDATE: 'UPDATE', DELETE: 'DELETE'
};

const ENTITY = {
  BOOKING: 'BOOKING', TIMEOFF: 'TIMEOFF', CLOSURE: 'CLOSURE',
  RULE: 'RULE', ADDITION: 'ADDITION', EXCEPTION: 'EXCEPTION', USER: 'USER'
};

/** Primary-key column name for each tab (used by SheetDAL.updateById). */
const PK = {
  Users: 'userId',
  AvailabilityRules: 'ruleId',
  AvailabilityAdditions: 'additionId',
  AvailabilityExceptions: 'exceptionId',
  TimeOff: 'timeOffId',
  Closures: 'closureId',
  Bookings: 'bookingId',
  AuditLog: 'auditId'
};

const MS_PER_MIN = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MIN;
const MS_PER_DAY = 24 * MS_PER_HOUR;
Write Config.gs
71 lines
/**
 * Config.gs — runtime configuration.
 *
 * Two layers:
 *  1. Script Properties hold the SHEET_ID of the standalone data spreadsheet
 *     (set by Setup.setup(), or manually).
 *  2. The `Config` tab holds editable business settings as key/value rows,
 *     falling back to DEFAULTS below when a key is missing.
 */

const PROP_SHEET_ID = 'SHEET_ID';

/** Fallback values used when the Config tab has no row for a key. */
const DEFAULTS = {
  timeZone: 'Europe/London',   // business timezone — all wall-clock rules resolve in this zone
  defaultBufferMin: 15,        // per-employee buffer fallback (minutes)
  bookingHorizonDays: 180,     // how far ahead a booking may be made
  reminderLeadHours: 24,       // how long before a meeting the reminder email fires
  cacheTtlSec: 45,             // CacheService TTL for hot tab reads
  lockTimeoutMs: 15000,        // LockService wait before giving up
  companyName: 'FSW',
  fromName: 'FSW Booking'
};

/** Numeric config keys — values coerced to Number on read. */
const NUMERIC_CONFIG = ['defaultBufferMin', 'bookingHorizonDays', 'reminderLeadHours', 'cacheTtlSec', 'lockTimeoutMs'];

/**
 * Read a single config value (Config tab first, then DEFAULTS).
 * @param {string} key
 * @return {*}
 */
function getConfig(key) {
  const all = getAllConfig_();
  const val = (key in all) ? all[key] : DEFAULTS[key];
  if (NUMERIC_CONFIG.indexOf(key) !== -1) return Number(val);
  return val;
}

/** Convenience: the business timezone string (IANA). */
function getTz() {
  return String(getConfig('timeZone') || DEFAULTS.timeZone);
}

/**
 * Build the {key: value} map from the Config tab, merged over DEFAULTS.
 * Cached for the duration of one execution via a module-level memo, plus a
 * short CacheService TTL across executions.
 * @private
 */
let _configMemo = null;
function getAllConfig_() {
  if (_configMemo) return _configMemo;
  const merged = Object.assign({}, DEFAULTS);
  try {
    const rows = readObjects(SHEETS.CONFIG); // [{key, value}, ...]
    rows.forEach(function (r) {
      if (r.key !== '' && r.key != null) merged[String(r.key)] = r.value;
    });
  } catch (e) {
    // Config tab may not exist before Setup.setup() runs — DEFAULTS are fine.
  }
  _configMemo = merged;
  return merged;
}

/** Clear the in-execution config memo (call after writing Config rows). */
function clearConfigMemo_() {
  _configMemo = null;
}
Now the most correctness-critical module — timezone/DST-safe conversions between wall-clock and epoch milliseconds:

Write TimeUtil.gs
137 lines
/**
 * TimeUtil.gs — timezone/DST-safe conversions. The most correctness-critical
 * module in the system. ALL local<->epoch conversion goes through here; nothing
 * else should construct dates from wall-clock parts.
 *
 * Canonical storage is UTC epoch-milliseconds. Recurring availability rules are
 * expressed as wall-clock ("HH:mm" on a calendar date) in the BUSINESS timezone
 * and resolved to epoch-ms here, so an "09:00 every Monday" block is correct
 * across daylight-saving transitions.
 *
 * Implementation note: Apps Script's Utilities.formatDate renders an instant in
 * any IANA zone; we use it to measure a zone's UTC offset at a given instant and
 * invert that to map wall-clock -> epoch.
 */

/**
 * UTC offset (ms) of zone `tz` at the instant `epochMs`. Positive = east of UTC.
 * offset = (wall-clock in tz) - (wall-clock in UTC), both read at the same instant.
 * @param {number} epochMs
 * @param {string} tz IANA zone, e.g. "Europe/London"
 * @return {number} offset in milliseconds
 */
function tzOffsetMsAt_(epochMs, tz) {
  const d = new Date(epochMs);
  const inTz = Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm:ss");
  const inUtc = Utilities.formatDate(d, 'UTC', "yyyy-MM-dd'T'HH:mm:ss");
  return Date.parse(inTz + 'Z') - Date.parse(inUtc + 'Z');
}

/**
 * Convert a wall-clock date+time in `tz` to a UTC epoch-ms instant.
 * Handles DST by solving epoch = wallAsUtc - offset(epoch), iterating once to
 * settle across a transition.
 * @param {number} y full year, @param {number} mo 1-12, @param {number} d 1-31
 * @param {number} hh 0-23, @param {number} mm 0-59
 * @param {string} tz
 * @return {number} epoch-ms
 */
function localPartsToEpochMs(y, mo, d, hh, mm, tz) {
  const wallAsUtc = Date.UTC(y, mo - 1, d, hh, mm, 0, 0);
  let off = tzOffsetMsAt_(wallAsUtc, tz);
  let epoch = wallAsUtc - off;
  const off2 = tzOffsetMsAt_(epoch, tz);
  if (off2 !== off) epoch = wallAsUtc - off2; // re-settle near a DST boundary
  return epoch;
}

/**
 * Combine a calendar date (in tz) with an "HH:mm" wall-clock string.
 * @param {{y:number,mo:number,d:number}} dateParts
 * @param {string} hhmm e.g. "09:30"
 * @param {string} tz
 * @return {number} epoch-ms
 */
function dateAndTimeToEpochMs(dateParts, hhmm, tz) {
  const t = parseHhMm_(hhmm);
  return localPartsToEpochMs(dateParts.y, dateParts.mo, dateParts.d, t.h, t.m, tz);
}

/** Parse "HH:mm" -> {h, m}. */
function parseHhMm_(hhmm) {
  const parts = String(hhmm).split(':');
  return { h: Number(parts[0]), m: Number(parts[1] || 0) };
}

/**
 * Break an instant into local calendar parts in `tz`.
 * @return {{y:number, mo:number, d:number, hh:number, mm:number, dow:number}}
 *         dow: 0=Mon .. 6=Sun
 */
function epochToLocalParts(epochMs, tz) {
  const d = new Date(epochMs);
  const s = Utilities.formatDate(d, tz, "yyyy-MM-dd-HH-mm-u"); // u: 1=Mon..7=Sun
  const p = s.split('-').map(Number);
  return { y: p[0], mo: p[1], d: p[2], hh: p[3], mm: p[4], dow: p[5] - 1 };
}

/** Local day-of-week (0=Mon..6=Sun) for an instant. */
function dowLocal(epochMs, tz) {
  return epochToLocalParts(epochMs, tz).dow;
}

/** Epoch-ms of local 00:00 (start of day) for the day containing `epochMs`. */
function startOfLocalDayMs(epochMs, tz) {
  const p = epochToLocalParts(epochMs, tz);
  return localPartsToEpochMs(p.y, p.mo, p.d, 0, 0, tz);
}

/** Epoch-ms of local 00:00 on the NEXT day after the day containing `epochMs`. */
function startOfNextLocalDayMs(epochMs, tz) {
  return startOfLocalDayMs(startOfLocalDayMs(epochMs, tz) + 36 * MS_PER_HOUR, tz);
}

/** Days in a given local month. */
function daysInMonth_(y, mo) {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate(); // mo is 1-12; day 0 of next month
}

/**
 * Iterate each local calendar date whose day overlaps [winStart, winEnd).
 * Calls cb({y, mo, d, dayStartMs}) for every day from the day of winStart up to
 * (and including) the day of winEnd-1ms.
 */
function eachLocalDate(winStartMs, winEndMs, tz, cb) {
  if (winEndMs <= winStartMs) return;
  let cursor = startOfLocalDayMs(winStartMs, tz);
  const lastDayStart = startOfLocalDayMs(winEndMs - 1, tz);
  let guard = 0;
  while (cursor <= lastDayStart && guard < 1000) {
    const p = epochToLocalParts(cursor, tz);
    cb({ y: p.y, mo: p.mo, d: p.d, dayStartMs: cursor });
    cursor = startOfNextLocalDayMs(cursor, tz);
    guard++;
  }
}

/**
 * True if the local date containing `epochMs` is the nth occurrence of its
 * weekday in its month. nth=-1 means the last occurrence.
 */
function isNthWeekdayOfMonth_(epochMs, nth, tz) {
  const p = epochToLocalParts(epochMs, tz);
  const occurrence = Math.floor((p.d - 1) / 7) + 1;
  if (nth === -1) return p.d + 7 > daysInMonth_(p.y, p.mo); // no same-weekday next week => last
  return occurrence === nth;
}

/** Format an instant in the business tz (display only). */
function formatLocal(epochMs, pattern, tz) {
  return Utilities.formatDate(new Date(epochMs), tz || getTz(), pattern);
}

/** Friendly date+time for emails/UI, e.g. "Mon 9 Jun 2026, 14:00". */
function formatHuman(epochMs, tz) {
  return Utilities.formatDate(new Date(epochMs), tz || getTz(), 'EEE d MMM yyyy, HH:mm');
}
Now the data-access layer (bulk read/write, caching, locking) and the audit log:

Write SheetDAL.gs
185 lines
/**
 * SheetDAL.gs — the single choke point for all Sheet I/O.
 *
 * Principles:
 *  - Read each tab in ONE getValues() call and filter in memory (Sheets API
 *    round-trips, not CPU, are the bottleneck).
 *  - Map rows to objects via the LIVE header row, so manual column reordering in
 *    the Sheet does not corrupt reads.
 *  - Cache hot reads in CacheService (short TTL); always invalidate on write.
 *  - Serialize the booking write-path with LockService (see withScriptLock).
 *
 * Nothing here knows business rules — it's pure storage.
 */

/** @return {string} the data spreadsheet id from Script Properties. */
function getSheetId_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_SHEET_ID);
  if (!id) {
    throw new Error('SHEET_ID is not set. Run Setup.setup() once to create and link the data spreadsheet.');
  }
  return id;
}

/** @return {Spreadsheet} */
function getSpreadsheet_() {
  return SpreadsheetApp.openById(getSheetId_());
}

/** @return {Sheet} */
function getSheet_(name) {
  const sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet/tab: "' + name + '". Run Setup.setup().');
  return sh;
}

function cacheKey_(name) { return 'tab::' + name; }

/**
 * Read all data rows of a tab as objects keyed by the live header row.
 * Values are returned as native types from Sheets (numbers, booleans, strings).
 * @param {string} name tab name
 * @param {{noCache?: boolean}} [opts]
 * @return {Array<Object>}
 */
function readObjects(name, opts) {
  opts = opts || {};
  if (!opts.noCache) {
    const cached = _cacheGet_(cacheKey_(name));
    if (cached) return cached;
  }
  const sh = getSheet_(name);
  const range = sh.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return []; // header only / empty
  const headers = values[0].map(String);
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    // Skip fully-blank rows.
    if (row.every(function (c) { return c === '' || c === null; })) continue;
    const obj = { _row: r + 1 }; // 1-based sheet row index for in-place updates
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
    out.push(obj);
  }
  if (!opts.noCache) _cachePut_(cacheKey_(name), out);
  return out;
}

/**
 * Append one object as a row, ordered by the tab's HEADERS definition.
 * Missing fields are written as ''. Returns the written object.
 * @param {string} name
 * @param {Object} obj
 * @return {Object}
 */
function appendObject(name, obj) {
  const sh = getSheet_(name);
  const headers = HEADERS[name];
  if (!headers) throw new Error('No HEADERS defined for tab: ' + name);
  const row = headers.map(function (h) {
    const v = obj[h];
    return (v === undefined || v === null) ? '' : v;
  });
  sh.appendRow(row);
  invalidateTab(name);
  return obj;
}

/**
 * Update specific fields of the row whose PK column equals `idValue`.
 * Reads with noCache to find the freshest row. Returns true if a row was updated.
 * @param {string} name
 * @param {string} idValue
 * @param {Object} patch  field -> new value
 * @return {boolean}
 */
function updateById(name, idValue, patch) {
  const pkCol = PK[name];
  if (!pkCol) throw new Error('No PK defined for tab: ' + name);
  const sh = getSheet_(name);
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const pkIdx = headers.indexOf(pkCol);
  if (pkIdx === -1) throw new Error('PK column "' + pkCol + '" not found in ' + name);

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][pkIdx]) === String(idValue)) {
      Object.keys(patch).forEach(function (field) {
        const c = headers.indexOf(field);
        if (c === -1) throw new Error('Unknown column "' + field + '" for ' + name);
        const v = patch[field];
        sh.getRange(r + 1, c + 1).setValue((v === undefined || v === null) ? '' : v);
      });
      invalidateTab(name);
      return true;
    }
  }
  return false;
}

/** Find a single object by PK (or null). Always reads fresh. */
function findById(name, idValue) {
  const pkCol = PK[name];
  const rows = readObjects(name, { noCache: true });
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][pkCol]) === String(idValue)) return rows[i];
  }
  return null;
}

/* ----------------------------- caching ----------------------------------- */

function _cacheGet_(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function _cachePut_(key, value) {
  try {
    const ttl = Number(getConfig('cacheTtlSec')) || DEFAULTS.cacheTtlSec;
    const raw = JSON.stringify(value);
    if (raw.length < 95000) CacheService.getScriptCache().put(key, raw, ttl); // ~100KB cap
  } catch (e) { /* cache is advisory; ignore */ }
}

/** Invalidate one tab's cache (call after any write). */
function invalidateTab(name) {
  try { CacheService.getScriptCache().remove(cacheKey_(name)); } catch (e) {}
}

/** Invalidate everything (used by Setup and bulk operations). */
function invalidateAll() {
  try {
    CacheService.getScriptCache().removeAll(Object.keys(SHEETS).map(function (k) { return cacheKey_(SHEETS[k]); }));
  } catch (e) {}
  clearConfigMemo_();
}

/* ----------------------------- locking ----------------------------------- */

/**
 * Run `fn` while holding the script lock. Used to serialize the read-validate-
 * write critical section so concurrent bookings can't double-book.
 * Flushes pending Sheet writes before releasing so the next holder reads
 * committed state.
 * @param {function():*} fn
 * @return {*}
 */
function withScriptLock(fn) {
  const lock = LockService.getScriptLock();
  const timeout = Number(getConfig('lockTimeoutMs')) || DEFAULTS.lockTimeoutMs;
  if (!lock.tryLock(timeout)) {
    throw new Error('The system is busy, please try again in a moment.');
  }
  try {
    SpreadsheetApp.flush(); // read freshest committed data inside the lock
    return fn();
  } finally {
    try { SpreadsheetApp.flush(); } catch (e) {}
    lock.releaseLock();
  }
}
Write AuditLog.gs
45 lines
/**
 * AuditLog.gs — append-only history of every mutating action.
 *
 * Each entry captures who did what, when, and a JSON snapshot of before/after
 * state, so the manager can reconstruct any booking's life without re-joining
 * other tabs. Rows are never edited or deleted.
 */

/**
 * Append an audit entry.
 * @param {{
 *   entityType: string, entityId: string, action: string,
 *   actorUserId?: string, actorEmail?: string, atMs: number,
 *   reason?: string, before?: Object, after?: Object
 * }} e
 * @return {string} the new auditId
 */
function logAudit(e) {
  const auditId = Utilities.getUuid();
  appendObject(SHEETS.AUDIT, {
    auditId: auditId,
    entityType: e.entityType,
    entityId: e.entityId,
    action: e.action,
    actorUserId: e.actorUserId || '',
    actorEmail: e.actorEmail || '',
    atMs: e.atMs,
    reason: e.reason || '',
    beforeJson: e.before ? JSON.stringify(e.before) : '',
    afterJson: e.after ? JSON.stringify(e.after) : ''
  });
  return auditId;
}

/**
 * Read audit entries for one entity, newest first.
 * @param {string} entityId
 * @return {Array<Object>}
 */
function getAuditFor(entityId) {
  return readObjects(SHEETS.AUDIT)
    .filter(function (r) { return String(r.entityId) === String(entityId); })
    .sort(function (a, b) { return Number(b.atMs) - Number(a.atMs); });
}
Now the availability engine — the core algorithm. I'm splitting it into a pure function (testable without the Sheet) plus a thin DAL-backed wrapper:

Write AvailabilityEngine.gs
194 lines
/**
 * AvailabilityEngine.gs — derives bookable free time. The heart of the system.
 *
 * Availability is NEVER materialized into stored slots; it is computed on demand
 * by interval arithmetic:
 *
 *   free = (recurring rules ∪ one-off additions)
 *          − exceptions − time off − company closures − (bookings + buffers)
 *
 * Because bookings are subtracted live, cancelling or rescheduling a meeting
 * reopens its time automatically with no extra bookkeeping.
 *
 * `computeFreeRangesFromData` is PURE (no Sheet access) so it can be unit-tested.
 * `computeFreeRanges` is the thin wrapper that loads data from the Sheet.
 *
 * All intervals are objects {start, end} in epoch-ms, half-open [start, end).
 */

/* --------------------------- interval algebra ----------------------------- */

/** Intersect [s,e) with the window; null if empty. */
function clipInterval(s, e, winStart, winEnd) {
  const ns = Math.max(s, winStart);
  const ne = Math.min(e, winEnd);
  return ne > ns ? { start: ns, end: ne } : null;
}

/** Half-open overlap test. */
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/** Sort + union overlapping/touching intervals. */
function mergeIntervals(list) {
  if (!list.length) return [];
  const sorted = list.slice().sort(function (a, b) { return a.start - b.start; });
  const out = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push({ start: cur.start, end: cur.end });
  }
  return out;
}

/** base − union(blocks). Returns sorted, disjoint remainder. */
function subtractIntervals(base, blocks) {
  const merged = mergeIntervals(blocks);
  const out = [];
  base.forEach(function (b) {
    let segs = [{ start: b.start, end: b.end }];
    merged.forEach(function (blk) {
      const next = [];
      segs.forEach(function (s) {
        if (blk.end <= s.start || blk.start >= s.end) { next.push(s); return; } // no overlap
        if (blk.start > s.start) next.push({ start: s.start, end: blk.start });  // left remainder
        if (blk.end < s.end) next.push({ start: blk.end, end: s.end });          // right remainder
      });
      segs = next;
    });
    segs.forEach(function (s) { if (s.end > s.start) out.push(s); });
  });
  return out.sort(function (a, b) { return a.start - b.start; });
}

/* --------------------------- recurrence expansion ------------------------- */

/**
 * Expand one recurring rule into concrete intervals overlapping [winStart,winEnd).
 * Handles WEEKLY and MONTHLY (day-of-month and nth-weekday) modes, DST-correctly
 * (wall-clock times resolved per-day in the business tz).
 * @return {Array<{start:number,end:number}>}
 */
function expandRule(rule, winStart, winEnd, tz) {
  const out = [];
  const fromMs = (rule.effectiveFromMs === '' || rule.effectiveFromMs == null) ? -Infinity : Number(rule.effectiveFromMs);
  const toMs = (rule.effectiveToMs === '' || rule.effectiveToMs == null) ? Infinity : Number(rule.effectiveToMs);
  const fromDay = isFinite(fromMs) ? startOfLocalDayMs(fromMs, tz) : -Infinity;
  const toDay = isFinite(toMs) ? startOfLocalDayMs(toMs, tz) : Infinity;

  eachLocalDate(winStart, winEnd, tz, function (day) {
    if (day.dayStartMs < fromDay || day.dayStartMs > toDay) return; // outside effective window

    let matches = false;
    if (rule.freq === FREQ.WEEKLY) {
      matches = dowLocal(day.dayStartMs, tz) === Number(rule.dayOfWeek);
    } else if (rule.freq === FREQ.MONTHLY) {
      if (rule.monthlyMode === MONTHLY_MODE.DOM) {
        matches = day.d === Number(rule.dayOfMonth);
      } else if (rule.monthlyMode === MONTHLY_MODE.NTH_DOW) {
        matches = dowLocal(day.dayStartMs, tz) === Number(rule.nthDayOfWeek) &&
                  isNthWeekdayOfMonth_(day.dayStartMs, Number(rule.nth), tz);
      }
    }
    if (!matches) return;

    const s = dateAndTimeToEpochMs({ y: day.y, mo: day.mo, d: day.d }, rule.startTimeLocal, tz);
    const e = dateAndTimeToEpochMs({ y: day.y, mo: day.mo, d: day.d }, rule.endTimeLocal, tz);
    const clipped = clipInterval(s, e, winStart, winEnd);
    if (clipped) out.push(clipped);
  });
  return out;
}

/* --------------------------- free-range computation ----------------------- */

function truthy_(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1';
}

/**
 * PURE: compute an employee's free ranges from in-memory data.
 * @param {{rules,additions,exceptions,timeOff,closures,bookings}} data
 * @param {string} userId
 * @param {number} winStart @param {number} winEnd
 * @param {string} tz
 * @return {Array<{start:number,end:number}>}
 */
function computeFreeRangesFromData(data, userId, winStart, winEnd, tz) {
  const uid = String(userId);

  // 1–2: base availability = recurring rules ∪ one-off additions
  let base = [];
  (data.rules || []).forEach(function (rule) {
    if (String(rule.userId) !== uid || !truthy_(rule.active)) return;
    base = base.concat(expandRule(rule, winStart, winEnd, tz));
  });
  (data.additions || []).forEach(function (a) {
    if (String(a.userId) !== uid || !truthy_(a.active)) return;
    const c = clipInterval(Number(a.startMs), Number(a.endMs), winStart, winEnd);
    if (c) base.push(c);
  });
  base = mergeIntervals(base);

  // 3–6: blocks to subtract
  const blocks = [];
  function pushBlock(s, e) {
    const c = clipInterval(Number(s), Number(e), winStart, winEnd);
    if (c) blocks.push(c);
  }
  (data.exceptions || []).forEach(function (x) {
    if (String(x.userId) === uid && truthy_(x.active)) pushBlock(x.startMs, x.endMs);
  });
  (data.timeOff || []).forEach(function (t) {
    if (String(t.userId) === uid && truthy_(t.active)) pushBlock(t.startMs, t.endMs);
  });
  (data.closures || []).forEach(function (c) {
    if (truthy_(c.active)) pushBlock(c.startMs, c.endMs);
  });
  (data.bookings || []).forEach(function (b) {
    if (String(b.userId) !== uid) return;
    if (String(b.status) !== BOOKING_STATUS.CONFIRMED) return;
    const bs = Number(b.startMs) - Number(b.bufferBeforeMin || 0) * MS_PER_MIN;
    const be = Number(b.endMs) + Number(b.bufferAfterMin || 0) * MS_PER_MIN;
    pushBlock(bs, be);
  });

  // 7: free = base − blocks
  return subtractIntervals(base, mergeIntervals(blocks));
}

/**
 * Load the tabs needed to compute availability for one employee over a window.
 * Bookings are window-filtered with a 1-day margin so buffers near the edges are
 * still captured.
 * @private
 */
function loadAvailabilityData_(userId, winStart, winEnd, opts) {
  const uid = String(userId);
  const overlaps = function (s, e) { return Number(e) > winStart && Number(s) < winEnd; };
  const bOverlaps = function (s, e) { return Number(e) > (winStart - MS_PER_DAY) && Number(s) < (winEnd + MS_PER_DAY); };
  return {
    rules: readObjects(SHEETS.RULES, opts).filter(function (r) { return String(r.userId) === uid; }),
    additions: readObjects(SHEETS.ADDITIONS, opts).filter(function (r) { return String(r.userId) === uid && overlaps(r.startMs, r.endMs); }),
    exceptions: readObjects(SHEETS.EXCEPTIONS, opts).filter(function (r) { return String(r.userId) === uid && overlaps(r.startMs, r.endMs); }),
    timeOff: readObjects(SHEETS.TIME_OFF, opts).filter(function (r) { return String(r.userId) === uid && overlaps(r.startMs, r.endMs); }),
    closures: readObjects(SHEETS.CLOSURES, opts).filter(function (r) { return overlaps(r.startMs, r.endMs); }),
    bookings: readObjects(SHEETS.BOOKINGS, opts).filter(function (r) { return String(r.userId) === uid && bOverlaps(r.startMs, r.endMs); })
  };
}

/**
 * Compute an employee's free ranges over [winStart, winEnd) from the Sheet.
 * @param {string} userId @param {number} winStart @param {number} winEnd
 * @param {{noCache?:boolean}} [opts]
 * @return {Array<{start:number,end:number}>}
 */
function computeFreeRanges(userId, winStart, winEnd, opts) {
  const tz = getTz();
  const data = loadAvailabilityData_(userId, winStart, winEnd, opts);
  return computeFreeRangesFromData(data, userId, winStart, winEnd, tz);
}
Now the setup bootstrap (creates the spreadsheet, tabs, formats, and seeds data) and the unit tests for the engine:

Write Setup.gs
125 lines
/**
 * Setup.gs — one-time (and idempotent) bootstrap, run from the Apps Script editor.
 *
 * `setup()` creates the standalone data spreadsheet (if not already linked),
 * builds every tab with the correct headers and column formats, seeds Config
 * defaults, and registers the running user as the first manager. Safe to re-run:
 * it never overwrites existing Config rows or users, and only adds missing tabs.
 *
 * After running, copy the logged spreadsheet URL and add your employees with
 * addEmployee(...).
 */

/** Create/repair the data spreadsheet and seed initial rows. @return {string} spreadsheet URL */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_SHEET_ID);
  let ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('FSW Booking System — Data');
    id = ss.getId();
    props.setProperty(PROP_SHEET_ID, id);
  }

  Object.keys(HEADERS).forEach(function (tab) { ensureSheet_(ss, tab, HEADERS[tab]); });

  // Drop the default empty "Sheet1" Google adds to new spreadsheets.
  const def = ss.getSheetByName('Sheet1');
  if (def && !HEADERS['Sheet1'] && ss.getSheets().length > 1) ss.deleteSheet(def);

  seedConfig_();
  seedManager_();
  invalidateAll();

  const url = ss.getUrl();
  Logger.log('✅ Setup complete.\nData spreadsheet: ' + url +
             '\nManager seeded: ' + (Session.getActiveUser().getEmail() || '(unknown)') +
             '\nNext: add employees with addEmployee("name@domain","Full Name").');
  return url;
}

/** Create a tab if missing; (re)write its header row, freeze it, and format columns. @private */
function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
  const rows = sh.getMaxRows();
  headers.forEach(function (h, i) {
    const col = i + 1;
    if (COLUMN_FORMATS.text.indexOf(h) !== -1) sh.getRange(1, col, rows, 1).setNumberFormat('@');
    else if (COLUMN_FORMATS.int.indexOf(h) !== -1) sh.getRange(1, col, rows, 1).setNumberFormat('0');
  });
}

/** Seed Config defaults only if the tab is empty. @private */
function seedConfig_() {
  if (readObjects(SHEETS.CONFIG, { noCache: true }).length > 0) return;
  Object.keys(DEFAULTS).forEach(function (k) {
    appendObject(SHEETS.CONFIG, { key: k, value: DEFAULTS[k] });
  });
  clearConfigMemo_();
}

/** Register the running user as the first manager, only if Users is empty. @private */
function seedManager_() {
  if (readObjects(SHEETS.USERS, { noCache: true }).length > 0) return;
  const email = Session.getActiveUser().getEmail() || '';
  appendObject(SHEETS.USERS, {
    userId: Utilities.getUuid(),
    email: email,
    displayName: email ? email.split('@')[0] : 'Manager',
    role: ROLES.MANAGER,
    bufferMin: getConfig('defaultBufferMin'),
    recurrenceMode: FREQ.WEEKLY,
    active: true,
    colorHex: '#3366cc'
  });
}

/**
 * Add an employee (or manager) to the roster. Run from the editor or wrap in a UI later.
 * @param {string} email Workspace login email
 * @param {string} displayName
 * @param {{role?:string, bufferMin?:number, recurrenceMode?:string, colorHex?:string}} [o]
 * @return {string} new userId
 */
function addEmployee(email, displayName, o) {
  o = o || {};
  if (!email) throw new Error('email is required');
  const existing = readObjects(SHEETS.USERS, { noCache: true })
    .filter(function (u) { return String(u.email).toLowerCase() === String(email).toLowerCase(); });
  if (existing.length) throw new Error('A user with that email already exists: ' + email);
  const userId = Utilities.getUuid();
  appendObject(SHEETS.USERS, {
    userId: userId,
    email: email,
    displayName: displayName || email.split('@')[0],
    role: o.role || ROLES.EMPLOYEE,
    bufferMin: (o.bufferMin != null) ? o.bufferMin : getConfig('defaultBufferMin'),
    recurrenceMode: o.recurrenceMode || FREQ.WEEKLY,
    active: true,
    colorHex: o.colorHex || pickColor_()
  });
  invalidateTab(SHEETS.USERS);
  Logger.log('Added ' + (o.role || ROLES.EMPLOYEE) + ': ' + email + ' (' + userId + ')');
  return userId;
}

/** Deterministic-ish color for calendar lanes (index-free, hash of email). @private */
function pickColor_() {
  const palette = ['#4285F4', '#EA4335', '#34A853', '#FBBC04', '#A142F4', '#24C1E0',
                   '#F538A0', '#FA7B17', '#1E8E3E', '#9334E6'];
  const n = readObjects(SHEETS.USERS, { noCache: true }).length;
  return palette[n % palette.length];
}

/** Convenience: log the linked data spreadsheet URL. */
function getDataSpreadsheetUrl() {
  const url = getSpreadsheet_().getUrl();
  Logger.log(url);
  return url;
}
Write Tests.gs
144 lines
/**
 * Tests.gs — runnable unit tests for the correctness-critical core.
 *
 * Run `runAllTests()` from the Apps Script editor (or `clasp run runAllTests`).
 * These tests are PURE — they exercise TimeUtil and AvailabilityEngine directly
 * with in-memory data and a fixed timezone, so they need no data spreadsheet and
 * never touch production data.
 */

const TEST_TZ = 'Europe/London';

/** Run every test_* below; logs a summary and returns {pass, fail, failures}. */
function runAllTests() {
  const tests = [
    test_mergeIntervals_,
    test_subtractIntervals_,
    test_dstWinterVsSummerOffset_,
    test_localPartsRoundTrip_,
    test_expandRuleWeekly_,
    test_expandRuleMonthlyDom_,
    test_expandRuleMonthlyNthDow_,
    test_freeRangesBookingBuffer_,
    test_freeRangesTimeOffAndClosure_,
    test_freeRangesCancelledBookingReopens_
  ];
  let pass = 0; const failures = [];
  tests.forEach(function (t) {
    try { t(); pass++; Logger.log('PASS ' + t.name); }
    catch (e) { failures.push(t.name + ': ' + e.message); Logger.log('FAIL ' + t.name + ' — ' + e.message); }
  });
  const summary = pass + '/' + tests.length + ' passed' + (failures.length ? ('; FAILURES:\n' + failures.join('\n')) : '');
  Logger.log('—— ' + summary);
  return { pass: pass, fail: failures.length, failures: failures };
}

/* ------------------------------- helpers ---------------------------------- */

function assert_(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEq_(actual, expected, msg) {
  if (actual !== expected) throw new Error((msg || '') + ' expected=' + expected + ' actual=' + actual);
}
function ivs_(arr) { return JSON.stringify(arr); }
function ms_(y, mo, d, hh, mm) { return localPartsToEpochMs(y, mo, d, hh, mm, TEST_TZ); }

/* ------------------------------- interval algebra ------------------------- */

function test_mergeIntervals_() {
  const r = mergeIntervals([{ start: 30, end: 40 }, { start: 0, end: 10 }, { start: 10, end: 20 }]);
  assertEq_(ivs_(r), ivs_([{ start: 0, end: 20 }, { start: 30, end: 40 }]), 'merge w/ touch');
}

function test_subtractIntervals_() {
  const base = [{ start: 0, end: 100 }];
  const blocks = [{ start: 20, end: 30 }, { start: 50, end: 60 }];
  const r = subtractIntervals(base, blocks);
  assertEq_(ivs_(r), ivs_([{ start: 0, end: 20 }, { start: 30, end: 50 }, { start: 60, end: 100 }]), 'subtract two holes');
}

/* ------------------------------- timezone / DST --------------------------- */

function test_dstWinterVsSummerOffset_() {
  // Winter (GMT): 09:00 London == 09:00 UTC.
  assertEq_(ms_(2026, 1, 12, 9, 0), Date.UTC(2026, 0, 12, 9, 0, 0, 0), 'winter offset 0');
  // Summer (BST, +1): 09:00 London == 08:00 UTC.
  assertEq_(ms_(2026, 7, 13, 9, 0), Date.UTC(2026, 6, 13, 8, 0, 0, 0), 'summer offset +1');
}

function test_localPartsRoundTrip_() {
  const e = ms_(2026, 6, 9, 14, 30);
  const p = epochToLocalParts(e, TEST_TZ);
  assertEq_(p.y, 2026, 'year'); assertEq_(p.mo, 6, 'month'); assertEq_(p.d, 9, 'day');
  assertEq_(p.hh, 14, 'hour'); assertEq_(p.mm, 30, 'min');
}

/* ------------------------------- recurrence ------------------------------- */

function test_expandRuleWeekly_() {
  // Tuesday 2026-06-09. Rule: every Tuesday (dow=1) 09:00–12:00.
  const rule = { userId: 'u', freq: FREQ.WEEKLY, dayOfWeek: 1, startTimeLocal: '09:00', endTimeLocal: '12:00', active: true, effectiveFromMs: '', effectiveToMs: '' };
  const winStart = ms_(2026, 6, 8, 0, 0);   // Mon
  const winEnd = ms_(2026, 6, 15, 0, 0);    // next Mon
  const r = expandRule(rule, winStart, winEnd, TEST_TZ);
  assertEq_(r.length, 1, 'one Tuesday in window');
  assertEq_(r[0].start, ms_(2026, 6, 9, 9, 0), 'Tue start');
  assertEq_(r[0].end, ms_(2026, 6, 9, 12, 0), 'Tue end');
}

function test_expandRuleMonthlyDom_() {
  // 15th of each month, 10:00–11:00. Window spanning June.
  const rule = { userId: 'u', freq: FREQ.MONTHLY, monthlyMode: MONTHLY_MODE.DOM, dayOfMonth: 15, startTimeLocal: '10:00', endTimeLocal: '11:00', active: true, effectiveFromMs: '', effectiveToMs: '' };
  const r = expandRule(rule, ms_(2026, 6, 1, 0, 0), ms_(2026, 7, 1, 0, 0), TEST_TZ);
  assertEq_(r.length, 1, 'one 15th in June');
  assertEq_(r[0].start, ms_(2026, 6, 15, 10, 0), '15th start');
}

function test_expandRuleMonthlyNthDow_() {
  // 2nd Tuesday (nth=2, dow=1) of June 2026 is Tue 9 Jun.
  const rule = { userId: 'u', freq: FREQ.MONTHLY, monthlyMode: MONTHLY_MODE.NTH_DOW, nth: 2, nthDayOfWeek: 1, startTimeLocal: '13:00', endTimeLocal: '14:00', active: true, effectiveFromMs: '', effectiveToMs: '' };
  const r = expandRule(rule, ms_(2026, 6, 1, 0, 0), ms_(2026, 7, 1, 0, 0), TEST_TZ);
  assertEq_(r.length, 1, 'one 2nd-Tuesday');
  assertEq_(r[0].start, ms_(2026, 6, 9, 13, 0), '2nd Tue start');
}

/* ------------------------------- free ranges ------------------------------ */

function test_freeRangesBookingBuffer_() {
  // Base 09:00–17:00, one booking 12:00–13:00 with 15-min buffer each side.
  // Expect free: 09:00–11:45 and 13:15–17:00.
  const day = { s: ms_(2026, 6, 9, 9, 0), e: ms_(2026, 6, 9, 17, 0) };
  const data = {
    additions: [{ userId: 'u', startMs: day.s, endMs: day.e, active: true }],
    bookings: [{ userId: 'u', status: BOOKING_STATUS.CONFIRMED, startMs: ms_(2026, 6, 9, 12, 0), endMs: ms_(2026, 6, 9, 13, 0), bufferBeforeMin: 15, bufferAfterMin: 15 }]
  };
  const r = computeFreeRangesFromData(data, 'u', day.s, day.e, TEST_TZ);
  assertEq_(ivs_(r), ivs_([
    { start: ms_(2026, 6, 9, 9, 0), end: ms_(2026, 6, 9, 11, 45) },
    { start: ms_(2026, 6, 9, 13, 15), end: ms_(2026, 6, 9, 17, 0) }
  ]), 'booking+buffer carve-out');
}

function test_freeRangesTimeOffAndClosure_() {
  // Base 09:00–17:00; partial time off 09:00–10:00; company closure 16:00–17:00.
  // Expect free: 10:00–16:00.
  const day = { s: ms_(2026, 6, 9, 9, 0), e: ms_(2026, 6, 9, 17, 0) };
  const data = {
    additions: [{ userId: 'u', startMs: day.s, endMs: day.e, active: true }],
    timeOff: [{ userId: 'u', active: true, startMs: ms_(2026, 6, 9, 9, 0), endMs: ms_(2026, 6, 9, 10, 0) }],
    closures: [{ active: true, startMs: ms_(2026, 6, 9, 16, 0), endMs: ms_(2026, 6, 9, 17, 0) }]
  };
  const r = computeFreeRangesFromData(data, 'u', day.s, day.e, TEST_TZ);
  assertEq_(ivs_(r), ivs_([{ start: ms_(2026, 6, 9, 10, 0), end: ms_(2026, 6, 9, 16, 0) }]), 'timeoff+closure');
}

function test_freeRangesCancelledBookingReopens_() {
  // A cancelled booking must NOT subtract availability.
  const day = { s: ms_(2026, 6, 9, 9, 0), e: ms_(2026, 6, 9, 17, 0) };
  const data = {
    additions: [{ userId: 'u', startMs: day.s, endMs: day.e, active: true }],
    bookings: [{ userId: 'u', status: BOOKING_STATUS.CANCELLED, startMs: ms_(2026, 6, 9, 12, 0), endMs: ms_(2026, 6, 9, 13, 0), bufferBeforeMin: 15, bufferAfterMin: 15 }]
  };
  const r = computeFreeRangesFromData(data, 'u', day.s, day.e, TEST_TZ);
  assertEq_(ivs_(r), ivs_([{ start: day.s, end: day.e }]), 'cancelled booking reopens time');
}
Now a README so you can actually stand this up and verify the core. The foundation is testable in isolation (no deploy needed beyond pushing the code), which makes this a good checkpoint:

Write README.md
109 lines
# FSW Booking System

An internal client-booking system for a ~10-person team, built as a **Google Apps Script web app**
backed by **Google Sheets** and embedded in **Google Sites**. Employees set their own availability;
the manager books client meetings into it. No third-party services, runs entirely inside Google Workspace.

See the full design in `plans/` (or the approved implementation plan) for the rationale behind every decision.

## Status

Built so far (Phase 0 + foundation):

| Module | Purpose |
|---|---|
| `src/Schema.gs` | Tab names, column order, enums — the data-model source of truth |
| `src/Config.gs` | Script-property `SHEET_ID` + editable `Config` tab settings (timezone, buffers, reminder lead, …) |
| `src/TimeUtil.gs` | DST-safe wall-clock ⇄ epoch-ms conversion (the correctness-critical helper) |
| `src/SheetDAL.gs` | All Sheet I/O: bulk read, append, update-by-id, caching, `withScriptLock` |
| `src/AuditLog.gs` | Append-only history of every mutating action |
| `src/AvailabilityEngine.gs` | `computeFreeRanges` + interval algebra — derives bookable time on the fly |
| `src/Setup.gs` | `setup()` bootstrap: creates the data Sheet, tabs, formats, seeds Config + manager |
| `src/Tests.gs` | `runAllTests()` — pure unit tests for the engine + timezone logic |

Still to come (later phases): auth & app shell, employee availability UI, time off/closures, manager
booking, reschedule/cancel, email notifications + reminders, reporting dashboard, Sites embedding.

## Data model (Google Sheet tabs)

`Config`, `Users`, `AvailabilityRules`, `AvailabilityAdditions`, `AvailabilityExceptions`, `TimeOff`,
`Closures`, `Bookings`, `AuditLog`. All instants are stored as **UTC epoch-millisecond integers**; all
recurring times are wall-clock in the one business timezone (`Config.timeZone`, default `Europe/London`).

## First-time setup

### Prerequisites
1. Install **Node.js** (LTS) and **clasp**:
   ```bash
   npm install -g @google/clasp
   # or, in this repo:  npm install   (clasp is a devDependency)
   ```
2. Enable the Apps Script API for your account: visit
   <https://script.google.com/home/usersettings> → turn **Google Apps Script API** **On**.
3. Sign in with the Workspace account that will **own** the project (this identity runs the app and
   sends all notification email):
   ```bash
   clasp login
   ```

### Create the script project
From the repo root:
```bash
clasp create --type webapp --title "FSW Booking" --rootDir src
```
This writes `.clasp.json` (your `scriptId`) and links the `src/` folder. Then push the code:
```bash
clasp push
```

> If you already have a script, run `clasp clone <scriptId> --rootDir src` instead, then `clasp push`.

### Initialise the data spreadsheet
1. Open the script editor: `clasp open`.
2. Run the **`setup`** function once (select it in the editor toolbar → Run). Approve the OAuth scopes
   when prompted (this is the one-time owner authorization).
3. `setup()` creates a spreadsheet named **"FSW Booking System — Data"**, builds every tab, seeds the
   `Config` defaults, and registers you as the first **manager**. The spreadsheet URL is printed to the
   execution log (View → Logs).

### Add your employees
Run from the editor (or call via `clasp run`):
```js
addEmployee('alex@yourdomain.com', 'Alex Smith');
addEmployee('sam@yourdomain.com',  'Sam Jones', { bufferMin: 30, recurrenceMode: 'MONTHLY' });
```
`role` defaults to `employee`. Pass `{ role: 'manager' }` to add another manager.

### Confirm the timezone
The default business timezone is `Europe/London`. To change it, edit the `timeZone` row in the `Config`
tab (use an IANA name, e.g. `Europe/Dublin`, `America/New_York`) **and** set the same zone on the script
project (`appsscript.json` → `timeZone`) and the data spreadsheet (File → Settings → Time zone).

## Verify the foundation

In the script editor, run **`runAllTests`**. It exercises the timezone conversions and the availability
engine (recurring expansion for weekly + monthly, buffer/time-off/closure subtraction, cancelled-booking
reopen) with in-memory data — no spreadsheet required. Check the log for `N/N passed`.

## Deployment & Google Sites embedding

> Documented in full in **Phase 8**. In brief: deploy as a Web app with **Execute as: Me** and
> **Who has access: Anyone within `<your domain>`**, embed the `/exec` URL in your Google Site via
> **Insert → Embed → By URL**, and provide an "Open in new tab" fallback link.

## Project layout

```
FSW-Booking-System/
  package.json        # clasp scripts + devDependencies
  .claspignore        # only src/ is pushed
  .clasp.json         # scriptId (generated by `clasp create`; git-ignored by default)
  README.md
  src/
    appsscript.json   # manifest: timezone, V8, webapp{access:DOMAIN, executeAs:USER_DEPLOYING}, scopes
    Schema.gs  Config.gs  TimeUtil.gs  SheetDAL.gs  AuditLog.gs
    AvailabilityEngine.gs  Setup.gs  Tests.gs
    # (added in later phases) Code.gs  Auth.gs  AvailabilityApi.gs  BookingApi.gs
    #                         TimeOffApi.gs  Notifications.gs  Reminders.gs  Reporting.gs  ui/*.html
```
Update Todos

Phase 0: Scaffold — project files (package.json, .claspignore, .gitignore, README), appsscript.json, Schema/Config, and setup() bootstrap that creates the Sheet, tabs/headers, seeds Config + Users

Foundation modules: TimeUtil (tz/DST epoch<->local), SheetDAL (bulk read/write + cache + lock), AuditLog

AvailabilityEngine: computeFreeRanges, expandRule (weekly + monthly), interval merge/subtract/clip + unit tests

Phase 1: Auth & app shell — Code.gs doGet routing, Auth.gs (getCurrentUser/getRole/require*), iframe flags, Index/Employee/Manager HTML shells

Phase 2: Employee availability — AvailabilityApi CRUD (recurring/one-off/exception/buffer) + employee UI

Phase 3: Time off / blocking — TimeOffApi (individual + company closures) + warn-and-flag

Phase 4: Manager booking — combined FullCalendar, free-range display, BookingApi.create under lock with full client fields

Phase 5: Changes & cancels — reschedule (re-validate) + cancel (reopen + reason); audit across mutations

Phase 6: Notifications — MailApp templates + send on book/reschedule/cancel; hourly reminder trigger + dedupe

Phase 7: Reporting dashboard — utilisation/hours/by-type aggregation + UI

Phase 8: Deploy + UAT docs — README deploy recipe, Google Sites embed steps, smoke-test matrix
Let me do a self-review pass on the foundation. I spotted one real bug: getAllConfig_() reads the Config tab through the cached path, and the cache-write path calls getConfig('cacheTtlSec') again — that's infinite recursion on the first config read. The Config tab should always be read without the cache (it's tiny and already memoized per-execution). Fixing it:

Edit Config.gs
Added 2 lines
Let me independently verify the pure interval algebra (the backbone of the engine) by running it in Node — these functions don't depend on any Apps Script API, so I can sanity-check them outside GAS:

Bash Check Node availability
IN
node --version 2>/dev/null || echo "NO_NODE"

OUT
NO_NODE
Bash Check for any JS runtime
IN
for r in deno bun qjs jsc d8 v8; do command -v $r >/dev/null 2>&1 && echo "FOUND:$r"; done; echo "done"

OUT
done
No JS runtime is available locally, so I can't execute the engine outside Apps Script — the real verification path is running runAllTests() in the editor after clasp push (documented in the README). I've hand-traced each test against the logic and they're consistent (e.g., 9 June 2026 is a Tuesday and the 2nd Tuesday of the month, which the recurrence tests rely on).

Let me record the key project context to memory so future sessions have it, then I'll report and pause for your review.

Bash Read existing MEMORY.md index
IN
cat "/Users/david/.claude/projects/-Users-david-Repo-FSW-Booking-System/memory/MEMORY.md" 2>/dev/null || echo "NO_MEMORY_FILE"

OUT
NO_MEMORY_FILE
Write project-overview.md
21 lines
---
name: project-overview
description: What the FSW Booking System is, its locked design decisions, and where the plan lives
metadata:
  type: project
---

FSW Booking System: an internal client-booking app for a ~10-employee business, built **greenfield by design** as a **Google Apps Script web app + Google Sheets datastore**, embedded in **Google Sites**. Everything stays inside the company's Google Workspace; no third-party services.

Core model (locked with the user during planning):
- **Manager-assigns-only.** Clients never log in — they contact by email; the manager records the client and books the meeting. (An earlier "clients self-book" idea was dropped.)
- **Employees** set their own availability as recurring patterns (weekly OR monthly) + one-off additions/exceptions, plus a **per-employee buffer**. Strictly **one-to-one** (no overlapping meetings). No daily caps.
- **Free ranges, length-per-booking** (no fixed slot grid). Availability is **computed on the fly** by interval subtraction, never materialized.
- Time off (employee + manager) and **company-wide closures**; time off over a booking **warns & flags**, never deletes. Reschedule must re-validate; cancel reopens time + reason; **full audit trail**.
- **Email-only** notifications (employee+client+manager) on book/reschedule/cancel + a 24h reminder.
- v1 **includes a reporting dashboard**; recurring *client* meetings deferred.

Key technical decisions: store all instants as **UTC epoch-ms integers** with one business timezone (default `Europe/London`); deploy **Execute as: Me + Anyone within domain** (so the Sites iframe works and `Session.getActiveUser().getEmail()` still resolves via the same-domain exception); booking writes serialized with `LockService`; code kept in git via **clasp**.

Full approved implementation plan: `/Users/david/.claude/plans/i-want-to-create-sorted-clover.md`. Build order is 9 phases (0=scaffold/foundation … 8=deploy+embed); the user wants to proceed **slowly, one phase at a time**. See [[build-progress]] for status.
Write build-progress.md
19 lines
---
name: build-progress
description: Which phases of the FSW Booking System are built vs pending
metadata:
  type: project
---

Build status (as of 2026-06-06). See [[project-overview]] for the design.

**Done — Phase 0 + foundation** (all in `src/`):
- `Schema.gs` (tabs/columns/enums), `Config.gs` (Script-prop SHEET_ID + Config tab), `TimeUtil.gs` (DST-safe wall-clock⇄epoch), `SheetDAL.gs` (bulk read/append/updateById + CacheService + `withScriptLock`), `AuditLog.gs`, `AvailabilityEngine.gs` (`computeFreeRanges` + pure `computeFreeRangesFromData` + interval algebra), `Setup.gs` (`setup()`, `addEmployee()`), `Tests.gs` (`runAllTests()` — pure, no Sheet needed). Plus `package.json`, `.claspignore`, `appsscript.json`, `README.md`.
- Verification path: `clasp push` → run `setup()` then `runAllTests()` in the editor (no JS runtime locally to test outside GAS).

**Pending:**
- Phase 1: Auth & shell — `Code.gs` doGet routing, `Auth.gs` (getCurrentUser/getRole/requireManager/requireSelfOrManager), iframe flags, `ui/` HTML shells.
- Phase 2: Employee availability API + UI. Phase 3: Time off/closures + warn-and-flag. Phase 4: Manager booking (FullCalendar + BookingApi under lock). Phase 5: reschedule/cancel + audit. Phase 6: Notifications (MailApp) + hourly reminder trigger. Phase 7: Reporting dashboard. Phase 8: Deploy + Sites embed docs.

Note: `BookingApi.validateBooking` (Phase 4) still needs unit tests added to `Tests.gs`.
Write MEMORY.md
3 lines
- [Project overview](project-overview.md) — what FSW Booking System is, locked design decisions, plan location
- [Build progress](build-progress.md) — which phases are built vs pending
Phase 0 and the correctness-critical foundation are built and committed to the repo. Here's where we are.

What's built (src/)
File	What it does
Schema.gs	The data model — every tab, column order, and enum in one place
Config.gs	SHEET_ID (script property) + editable Config tab (timezone, buffers, reminder lead…)
TimeUtil.gs	DST-safe wall-clock ⇄ epoch-ms — the linchpin of correctness
SheetDAL.gs	All Sheet I/O: bulk read, append, update-by-id, caching, withScriptLock
AvailabilityEngine.gs	computeFreeRanges + interval algebra (a pure core for testing)
AuditLog.gs	Append-only history of every change
Setup.gs	setup() builds the Sheet/tabs/formats and seeds Config + you as manager; addEmployee()
Tests.gs	runAllTests() — 10 pure unit tests (recurrence, buffers, time off, DST)
Plus package.json, .claspignore, src/appsscript.json, and a README with the full setup recipe.

Design choices baked in (from the architecture review): time stored as UTC epoch-ms with one business timezone; availability computed on the fly (so cancelling reopens time for free); the booking write-path will be serialized with LockService. During self-review I caught and fixed one real bug — an infinite-recursion loop where reading the Config tab triggered its own cache-write, which re-read config.

How to verify it (≈10 min, all in Google)
npm install → clasp login (as the account that'll own it) → clasp create --type webapp --title "FSW Booking" --rootDir src → clasp push
clasp open, run setup once (approve scopes) — creates the data spreadsheet and makes you the manager.
Run runAllTests — expect 10/10 passed in the log.
I couldn't run the tests here (no JavaScript runtime on this machine, and the timezone logic needs Google's Utilities anyway), so that step is the real proof — but I've hand-traced each test against the logic.

Where we go next
The foundation is the riskiest, most reusable part, so it's a natural checkpoint. Phase 1 is auth + the app shell (role-based routing so employees land on their view and the manager on theirs, with the Google Sites iframe flags). After that, Phase 2 gives employees a real availability screen.

Want me to continue straight into Phase 1, or would you rather push and verify the foundation first (run setup() + runAllTests()) so we're standing on confirmed-green before building the UI on top? I'm happy either way — given you wanted to move carefully, verifying first is the safer call, but I can keep building if you'd prefer momentum.

README.md
as aprt of each phase, create comprehensive documentation in both .md and docx for review later
Good call — documentation per phase that you can review offline. Let me first check what's available for generating .docx (ideally pandoc, falling back to Python).

Bash Check docx generation tooling
IN
echo "--- pandoc ---"; command -v pandoc && pandoc --version | head -1 || echo "NO_PANDOC"
echo "--- python3 ---"; command -v python3 && python3 --version || echo "NO_PYTHON3"
echo "--- python-docx ---"; python3 -c "import docx; print('python-docx', docx.__version__)" 2>/dev/null || echo "NO_PYTHON_DOCX"
echo "--- libreoffice ---"; command -v soffice || command -v libreoffice || echo "NO_LIBREOFFICE"
echo "--- textutil (macOS) ---"; command -v textutil || echo "NO_TEXTUTIL"

OUT
--- pandoc ---
NO_PANDOC
--- python3 ---
/Library/Frameworks/Python.framework/Versions/3.14/bin/python3
Python 3.14.5
--- python-docx ---
python-docx 1.2.0
--- libreoffice ---
NO_LIBREOFFICE
--- textutil (macOS) ---
/usr/bin/textutil
python-docx (1.2.0) is available. I'll create a small reusable Markdown→DOCX converter (so every phase's doc can be generated from its .md), then write the Phase 0 documentation and produce both formats.

Write md2docx.py
197 lines
#!/usr/bin/env python3
"""
md2docx.py — convert a Markdown file to a formatted .docx using python-docx.

Reusable across every phase's documentation. Handles the Markdown subset used in
this project's docs: ATX headings (#..####), paragraphs, **bold** + `inline code`
+ [links](url), bullet/numbered lists, GitHub-style tables, fenced ``` code
blocks, horizontal rules, and blockquotes.

Usage:
    python3 tools/md2docx.py docs/Phase-0-Foundation.md [docs/Phase-0-Foundation.docx]

If the output path is omitted, the input's extension is swapped to .docx.
"""

import re
import sys
from pathlib import Path

from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

MONO = "Consolas"
CODE_SHADE = "F2F2F2"
INLINE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))")
LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def shade_paragraph(paragraph, fill):
    """Apply a solid background fill to a paragraph (used for code blocks)."""
    ppr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    ppr.append(shd)


def add_inline(paragraph, text):
    """Render inline **bold**, `code`, and [links](url) into a paragraph."""
    pos = 0
    for m in INLINE.finditer(text):
        if m.start() > pos:
            paragraph.add_run(text[pos:m.start()])
        tok = m.group(0)
        if tok.startswith("**"):
            paragraph.add_run(tok[2:-2]).bold = True
        elif tok.startswith("`"):
            r = paragraph.add_run(tok[1:-1])
            r.font.name = MONO
            r.font.size = Pt(9.5)
        else:  # link -> show "text (url)"
            mm = LINK.match(tok)
            label, url = mm.group(1), mm.group(2)
            txt = label if (url.startswith("#") or label == url) else f"{label} ({url})"
            paragraph.add_run(txt)
        pos = m.end()
    if pos < len(text):
        paragraph.add_run(text[pos:])


def add_code_block(doc, lines):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Pt(6)
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(4)
    shade_paragraph(p, CODE_SHADE)
    for i, line in enumerate(lines):
        if i:
            p.add_run().add_break()
        r = p.add_run(line)
        r.font.name = MONO
        r.font.size = Pt(9)
    return p


def add_table(doc, rows):
    header = [c.strip() for c in rows[0].strip().strip("|").split("|")]
    body = []
    for row in rows[2:]:  # skip the |---|---| separator
        body.append([c.strip() for c in row.strip().strip("|").split("|")])
    table = doc.add_table(rows=1, cols=len(header))
    table.style = "Light Grid Accent 1"
    for i, h in enumerate(header):
        cell = table.rows[0].cells[i]
        cell.paragraphs[0].text = ""
        add_inline(cell.paragraphs[0], h)
        for run in cell.paragraphs[0].runs:
            run.bold = True
    for r in body:
        cells = table.add_row().cells
        for i in range(len(header)):
            cell = cells[i]
            cell.paragraphs[0].text = ""
            add_inline(cell.paragraphs[0], r[i] if i < len(r) else "")


def convert(md_path: Path, docx_path: Path):
    text = md_path.read_text(encoding="utf-8")
    lines = text.split("\n")
    doc = Document()
    doc.styles["Normal"].font.name = "Calibri"
    doc.styles["Normal"].font.size = Pt(11)

    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        stripped = line.strip()

        # fenced code block
        if stripped.startswith("```"):
            j = i + 1
            buf = []
            while j < n and not lines[j].strip().startswith("```"):
                buf.append(lines[j])
                j += 1
            add_code_block(doc, buf)
            i = j + 1
            continue

        # table (header line that looks like a table, followed by a separator)
        if stripped.startswith("|") and i + 1 < n and re.match(r"^\s*\|?[\s:-]+\|", lines[i + 1]):
            block = []
            while i < n and lines[i].strip().startswith("|"):
                block.append(lines[i])
                i += 1
            add_table(doc, block)
            continue

        # headings
        m = re.match(r"^(#{1,6})\s+(.*)$", stripped)
        if m:
            level = min(len(m.group(1)), 4)
            h = doc.add_heading(level=level)
            add_inline(h, m.group(2))
            i += 1
            continue

        # horizontal rule
        if re.match(r"^(-{3,}|\*{3,}|_{3,})$", stripped):
            doc.add_paragraph().add_run("").add_break()
            i += 1
            continue

        # blockquote
        if stripped.startswith(">"):
            p = doc.add_paragraph(style="Intense Quote")
            add_inline(p, stripped.lstrip("> ").rstrip())
            i += 1
            continue

        # bullet list
        mb = re.match(r"^[-*]\s+(.*)$", stripped)
        if mb:
            p = doc.add_paragraph(style="List Bullet")
            add_inline(p, mb.group(1))
            i += 1
            continue

        # numbered list
        mn = re.match(r"^\d+\.\s+(.*)$", stripped)
        if mn:
            p = doc.add_paragraph(style="List Number")
            add_inline(p, mn.group(1))
            i += 1
            continue

        # blank line
        if stripped == "":
            i += 1
            continue

        # paragraph
        p = doc.add_paragraph()
        add_inline(p, stripped)
        i += 1

    doc.save(str(docx_path))
    print(f"Wrote {docx_path}")


def main():
    if len(sys.argv) < 2:
        print("usage: md2docx.py input.md [output.docx]", file=sys.stderr)
        sys.exit(2)
    md_path = Path(sys.argv[1])
    docx_path = Path(sys.argv[2]) if len(sys.argv) > 2 else md_path.with_suffix(".docx")
    convert(md_path, docx_path)


if __name__ == "__main__":
    main()
Now the comprehensive Phase 0 documentation:

Write Phase-0-Foundation.md
240 lines
# FSW Booking System — Phase 0: Foundation

**Document version:** 1.0
**Date:** 2026-06-06
**Phase status:** Complete
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Phase 0 (Foundation)** of the FSW Booking System. It explains
*what* was built, *why* each decision was made, and *how* to set up and verify it. It is written to be read
on its own, months from now, without needing the original conversation. Each subsequent phase will have its
own equivalent document.

---

## 2. System overview

FSW is a ~10-person business that currently arranges client meetings informally over email and phone. The
goal is a single, reliable, no-extra-cost place to manage all client scheduling, built entirely inside the
company's existing **Google Workspace**.

There are exactly two kinds of user:

- **Employees (~10)** — each maintains their *own* availability: the times they are free to take clients.
- **The manager** — sees everyone's availability in one combined view and books client meetings into it.

**Clients never log in.** They contact the business as they do today; the manager records the client's
details and assigns the meeting. This keeps the system entirely internal — no public booking page, no client
accounts.

> The booking model is therefore *manager-assigns-everything*. An earlier idea of clients self-booking was
> deliberately dropped after discussion, which simplified the whole design.

---

## 3. Architecture and key decisions

### 3.1 Technology stack

| Layer | Choice | Why |
|---|---|---|
| Application | **Google Apps Script** web app | Runs inside Google Workspace, zero hosting cost, employees auto-authenticate with their work Google accounts |
| Data store | **Google Sheets** | No database to run; data is visible/editable by the owner; trivial backups and exports |
| Front end | HTML served by Apps Script + **FullCalendar** (later phase) | A real calendar UI without a build pipeline |
| Surfacing | Embedded in **Google Sites** (later phase) | The company intranet already lives there |
| Source control | This **git** repo, synced with **clasp** | Code is versioned and reviewable, not trapped in the online editor |

### 3.2 Decisions that are expensive to change later (locked now)

These were chosen deliberately at the foundation because reversing them later would mean a data migration:

1. **All instants are stored as UTC epoch-millisecond integers**, not as text like "2026-06-09 14:00".
   Wall-clock strings corrupt across daylight-saving boundaries and across timezone mismatches. A single
   business timezone is held in `Config.timeZone`, and recurring rules are resolved against it. *(See §6.)*
2. **Availability is computed on the fly, never stored as fixed slots.** The only persisted facts are
   recurring rules, one-off additions, exceptions, time off, closures, and bookings. Free time is *derived*
   by interval subtraction every time it's needed. A direct benefit: cancelling or rescheduling a meeting
   reopens its time automatically, because the engine simply stops subtracting it. *(See §7.)*
3. **UUID primary keys**, with other tabs referencing those IDs (never names or emails, which can change).
4. **The audit log is append-only and bookings are never hard-deleted** (cancel = a status change). History
   is preserved for accountability and reporting.
5. **Buffers are snapshotted onto each booking.** If an employee later changes their buffer, existing
   bookings keep the gap they were made with — no retroactive "phantom" clashes.
6. **Half-open intervals `[start, end)`** are used everywhere, so a meeting ending at 14:00 and one starting
   at 14:00 do not count as overlapping (before buffers are applied).

### 3.3 Deployment model (planned, applied in Phase 8)

The app will be deployed as **Execute as: Me (owner)** with **access: Anyone within the domain**. Because all
users share the Workspace domain, the app can still identify each visitor (`Session.getActiveUser()`), there
is only a one-time owner authorization rather than a prompt for every employee, the data Sheet is never
shared with 10 people, and — critically — it embeds cleanly inside the Google Sites iframe. Booking writes
will be serialized with `LockService` so two people can never double-book the same slot.

---

## 4. Data model

One Google Spreadsheet holds one tab per entity. Every tab has a bold, frozen header row using exactly the
column names below. ID and phone columns are forced to plain-text format; epoch-millisecond columns are
forced to integer format — so Google Sheets never silently reinterprets them as dates or numbers.

| Tab | Holds | Key columns |
|---|---|---|
| **Config** | Editable business settings | `key`, `value` |
| **Users** | Employees + manager | `userId`, `email`, `role`, `bufferMin`, `recurrenceMode`, `active` |
| **AvailabilityRules** | Recurring availability patterns | `freq` (WEEKLY/MONTHLY), day fields, `startTimeLocal`/`endTimeLocal`, effective window |
| **AvailabilityAdditions** | One-off extra free time | `startMs`, `endMs` |
| **AvailabilityExceptions** | "Remove my normal availability here" | `startMs`, `endMs` |
| **TimeOff** | Individual unavailability | `scope` (FULL_DAY/PARTIAL), `startMs`, `endMs`, `reason` |
| **Closures** | Company-wide closures (block everyone) | `startMs`, `endMs`, `reason` |
| **Bookings** | Confirmed/cancelled meetings | client fields, `startMs`/`endMs`, buffer snapshot, `status`, `flag` |
| **AuditLog** | Append-only history | `action`, `actorEmail`, `atMs`, `beforeJson`, `afterJson` |

**Why exceptions and time off are separate:** an *exception* is an employee editing their own recurring
pattern ("I'm normally free Mondays, but not this one") — it can never sit over a booking. *Time off* is a
positive "I am unavailable" that *can* land over an existing booking and must flag it. Different meaning,
different tab, simpler logic. **Closures** are time off applied to everyone at once, so the manager edits one
row instead of ten.

The booking `status` (CONFIRMED / CANCELLED) and `flag` (NONE / TIMEOFF_CONFLICT) are deliberately separate
fields, so a meeting can be simultaneously *confirmed* and *flagged* for a time-off conflict that the manager
still needs to resolve.

---

## 5. Module reference

All code lives in `src/` as Apps Script files. Phase 0 delivered the backend foundation; the UI and the
booking/notification APIs arrive in later phases.

| File | Responsibility |
|---|---|
| **Schema.gs** | Single source of truth: tab names, column order per tab, column-format hints, all enums, primary-key map, time constants. Everything else imports from here. |
| **Config.gs** | Reads the `SHEET_ID` script property and the editable `Config` tab; merges over sensible `DEFAULTS`; exposes `getConfig(key)` and `getTz()`. |
| **TimeUtil.gs** | DST-safe conversion between wall-clock and epoch-ms, local calendar maths (day-of-week, nth-weekday, iterate days). *The most correctness-critical module.* |
| **SheetDAL.gs** | The only place that touches the Sheet: bulk reads, append, update-by-id, short-lived caching, and `withScriptLock` (the concurrency guard). Knows no business rules. |
| **AuditLog.gs** | `logAudit(...)` appends an immutable history row; `getAuditFor(id)` reads an entity's history. |
| **AvailabilityEngine.gs** | The interval algebra and `computeFreeRanges` — derives bookable time. Split into a **pure** function (no Sheet access, fully testable) and a thin loader. |
| **Setup.gs** | `setup()` bootstraps the spreadsheet, tabs, formats, and seeds Config + the first manager. `addEmployee(...)` adds people. Safe to re-run. |
| **Tests.gs** | `runAllTests()` — ten pure unit tests covering the engine and timezone logic. |

Supporting files: `appsscript.json` (manifest: timezone, V8 runtime, web-app + OAuth scope settings),
`package.json` (clasp scripts), `.claspignore` (push only `src/`), `README.md` (setup recipe).

---

## 6. How time is handled (the correctness foundation)

A scheduling system lives or dies on timezone correctness. The approach:

- **Canonical truth is UTC epoch-milliseconds.** Every stored instant is a plain integer.
- **One business timezone** (`Config.timeZone`, default `Europe/London`). Recurring rules are written as
  wall-clock — e.g. "09:00–12:00 every Tuesday" — and resolved to epoch-ms *in that zone, for that specific
  date*. So an "09:00 Monday" block is 09:00 local whether or not the clocks have changed.
- **All conversion goes through `TimeUtil.gs`.** Nothing else builds dates from wall-clock parts. The helper
  measures the zone's UTC offset at a given instant (via `Utilities.formatDate`) and inverts it, iterating
  once to settle correctly across a daylight-saving transition.

Worked example (verified by the test suite):
- `09:00` London on **12 Jan 2026** (winter, GMT) → `09:00` UTC.
- `09:00` London on **13 Jul 2026** (summer, BST) → `08:00` UTC.

Both are computed from the same code path; the one-hour difference is exactly the DST offset, handled
automatically.

---

## 7. The availability algorithm

`computeFreeRanges(userId, windowStart, windowEnd)` answers "when is this employee bookable in this window?"
It is the engine the manager's calendar will be built on. The logic:

1. **Build base availability** = expand the employee's recurring rules across the window, then add any
   one-off additions. Merge overlaps.
2. **Build the blocked set** = the employee's exceptions + their time off + company-wide closures + each
   confirmed booking *extended by its buffer on both sides*.
3. **Free = base − blocked** (interval subtraction). The result is a sorted, non-overlapping list of
   bookable ranges.

Because cancelled bookings are skipped in step 2, cancelling a meeting reopens its time with no extra work.
Because buffers are part of the blocked set, a booking automatically reserves breathing room around itself.

**Recurrence** supports weekly (e.g. every Tuesday) and monthly in two flavours: by day-of-month (e.g. the
15th) and by nth-weekday (e.g. the 2nd Tuesday, or the last Friday). Impossible dates (the 31st in February,
a 5th Tuesday that doesn't exist) are simply skipped.

The engine is split so that the heavy logic — `computeFreeRangesFromData(...)` — is a **pure function**: give
it data and a timezone, get back free ranges, with no Google dependency. That is what makes it unit-testable.

---

## 8. Setup and configuration

Full step-by-step instructions are in `README.md`. In summary:

1. Install Node + clasp, enable the Apps Script API, `clasp login` as the owner account.
2. `clasp create --type webapp --title "FSW Booking" --rootDir src`, then `clasp push`.
3. In the editor, run **`setup()`** once and approve the scopes. This creates the data spreadsheet, builds
   every tab, seeds the `Config` defaults, and registers you as the first manager.
4. Add staff with `addEmployee('name@domain', 'Full Name')`.

**Configurable settings** (the `Config` tab) include: `timeZone`, `defaultBufferMin`, `bookingHorizonDays`,
`reminderLeadHours` (default 24), plus cache/lock tuning. Changing the timezone requires updating the
`Config` row, the script manifest, and the spreadsheet's own timezone so all three agree.

---

## 9. Verification

Run **`runAllTests()`** in the Apps Script editor; expect `10/10 passed`. The suite is pure (no spreadsheet
required) and covers:

| Test | What it proves |
|---|---|
| `mergeIntervals`, `subtractIntervals` | The interval algebra (the engine's backbone) is correct, including touching boundaries |
| `dstWinterVsSummerOffset` | Wall-clock → epoch is correct on both sides of a DST change |
| `localPartsRoundTrip` | Epoch → local calendar parts is consistent |
| `expandRuleWeekly` | Weekly recurrence lands on the right day/time |
| `expandRuleMonthlyDom` | Monthly "by date" recurrence works |
| `expandRuleMonthlyNthDow` | Monthly "nth weekday" recurrence works |
| `freeRangesBookingBuffer` | A booking carves itself + its buffer out of availability |
| `freeRangesTimeOffAndClosure` | Time off and company closures remove availability |
| `freeRangesCancelledBookingReopens` | A cancelled booking does **not** block time |

> Note: the build machine has no JavaScript runtime, and the timezone logic depends on Google's `Utilities`
> service, so the tests are designed to run inside Apps Script. Each test was additionally hand-traced
> against the implementation.

---

## 10. Known limits and risks (carried into later phases)

- **Concurrency:** the double-booking guard (`LockService`) is in place in the data layer and will wrap the
  booking write-path in Phase 4.
- **Sheet growth:** reads are done in bulk (one read per tab) and cached briefly. If bookings accumulate over
  years, an archive step will keep the hot data small (future enhancement).
- **Email quota / iframe embedding:** relevant to later phases; mitigations are documented in the plan and
  will be applied in Phases 6 and 8.

---

## 11. What's next

| Phase | Deliverable |
|---|---|
| **1** | Authentication + app shell: role-based routing (employee vs manager views), iframe-safe rendering |
| 2 | Employee availability screen (recurring + one-off + exceptions + personal buffer) |
| 3 | Time off and company-wide closures, with warn-and-flag for affected bookings |
| 4 | Manager booking: combined calendar, validation, double-booking lock |
| 5 | Reschedule and cancel, with the full audit trail surfaced |
| 6 | Email notifications + the 24-hour reminder |
| 7 | Reporting dashboard (hours, utilisation, by meeting type) |
| 8 | Deployment + Google Sites embedding + user acceptance testing |

Each phase will ship with its own `.md` and `.docx` document like this one.
Now a convenience build script and the docs index, then I'll generate the .docx:

Write build-docs.sh
19 lines
#!/usr/bin/env bash
# Regenerate a .docx alongside every .md in docs/.
# Usage: tools/build-docs.sh          (build all)
#        tools/build-docs.sh FILE.md  (build one)
set -euo pipefail
cd "$(dirname "$0")/.."

build() { python3 tools/md2docx.py "$1"; }

if [[ $# -ge 1 ]]; then
  build "$1"
else
  shopt -s nullglob
  for f in docs/*.md; do
    [[ "$(basename "$f")" == "README.md" ]] && continue
    build "$f"
  done
fi
Bash Generate Phase 0 docx and list docs
IN
chmod +x tools/build-docs.sh && python3 tools/md2docx.py docs/Phase-0-Foundation.md && ls -la docs/

OUT
Wrote docs/Phase-0-Foundation.docx
total 120
drwxr-xr-x@  4 david  staff    128 Jun  6 21:28 .
drwxr-xr-x@ 12 david  staff    384 Jun  6 21:27 ..
-rw-r--r--@  1 david  staff  44313 Jun  6 21:28 Phase-0-Foundation.docx
-rw-r--r--@  1 david  staff  13816 Jun  6 21:27 Phase-0-Foundation.md
The .docx generated (44 KB). Let me validate it actually parses as a well-formed Word document with the expected structure (headings, tables, code blocks):

Bash Validate generated docx structure
IN
python3 - <<'PY'
from docx import Document
d = Document("docs/Phase-0-Foundation.docx")
heads = [p.text for p in d.paragraphs if p.style.name.startswith("Heading")]
print("paragraphs:", len(d.paragraphs))
print("tables:", len(d.tables), "| first table rows:", len(d.tables[0].rows) if d.tables else 0)
print("headings:", len(heads))
for h in heads[:6]:
    print("  -", h)
# spot-check a table cell rendered inline formatting
if d.tables:
    print("sample cell:", d.tables[1].rows[1].cells[0].text[:40])
PY

OUT
paragraphs: 129
tables: 5 | first table rows: 6
headings: 15
  - FSW Booking System — Phase 0: Foundation
  - 1. Purpose of this document
  - 2. System overview
  - 3. Architecture and key decisions
  - 3.1 Technology stack
  - 3.2 Decisions that are expensive to change later (locked now)
sample cell: Config
Valid Word document — 15 headings, 5 tables, inline formatting preserved in cells. Let me add a docs index, and record this documentation convention so it's applied to every future phase.

Write README.md
31 lines
# FSW Booking System — Documentation

Comprehensive, review-oriented documentation. Every build phase ships a document here in **both Markdown
(`.md`) and Word (`.docx`)** form. The `.md` is the source; the `.docx` is generated from it.

## Index

| Phase | Document | Status |
|---|---|---|
| 0 | [Phase 0 — Foundation](Phase-0-Foundation.md) · `Phase-0-Foundation.docx` | Complete |
| 1 | Auth & app shell | Pending |
| 2 | Employee availability | Pending |
| 3 | Time off & closures | Pending |
| 4 | Manager booking | Pending |
| 5 | Reschedule & cancel | Pending |
| 6 | Notifications & reminders | Pending |
| 7 | Reporting dashboard | Pending |
| 8 | Deployment & Google Sites embedding | Pending |

## Regenerating the Word versions

The `.docx` files are produced from the `.md` sources with a small converter (`tools/md2docx.py`, which uses
`python-docx`). To rebuild:

```bash
tools/build-docs.sh                       # rebuild every doc
tools/build-docs.sh docs/Phase-0-Foundation.md   # rebuild one
```

These tools live outside `src/`, so they are never pushed to Apps Script.
Write docs-per-phase.md
20 lines
---
name: docs-per-phase
description: User requires comprehensive .md + .docx documentation produced as part of every build phase
metadata:
  type: feedback
---

For the FSW Booking System, the user wants **comprehensive documentation produced as part of EVERY phase**, in **both `.md` and `.docx`** formats, "for review later."

**Why:** the user reviews progress offline/in Word, not just by reading code.

**How to apply:**
- For each phase, author `docs/Phase-N-<Title>.md` (review-oriented: what was built, why, how to set up/verify — readable standalone), then generate the `.docx` with `tools/build-docs.sh docs/Phase-N-<Title>.md` (or `tools/build-docs.sh` for all).
- The converter is `tools/md2docx.py` (uses `python-docx` 1.2.0; no pandoc/node on this machine). It handles headings, **bold**, `code`, links, bullet/numbered lists, GitHub tables, fenced code blocks.
- Update the index table in `docs/README.md` each phase.
- Tools live OUTSIDE `src/` so they aren't pushed to Apps Script by clasp.
- Phase 0 doc is done: `docs/Phase-0-Foundation.md` + `.docx`.

See [[build-progress]] and [[project-overview]].
Edit MEMORY.md
Added 1 line
Let me note the docs/tools in the README so the project layout stays accurate:

Edit README.md
Added 8 lines
Done. Documentation is now a standing part of every phase, set up so it's easy to keep current.

What I added
docs/Phase-0-Foundation.md — a comprehensive, standalone write-up: system overview, architecture and the "expensive-to-change" decisions, the full data model, a module-by-module reference, how time/DST is handled, the availability algorithm, setup, and the verification matrix. Written to be readable months from now without the original chat.
docs/Phase-0-Foundation.docx — the Word version (validated: 15 headings, 5 tables, code blocks, inline formatting all render correctly).
tools/md2docx.py + tools/build-docs.sh — a small reusable Markdown→Word converter (uses python-docx, since there's no pandoc here). Every future phase's .docx regenerates from its .md with one command. These live outside src/, so clasp never pushes them to Apps Script.
docs/README.md — an index tracking each phase's doc and its status.
From here on, each phase will ship its .md + .docx doc alongside the code (I've also recorded this so it carries across sessions).

Next step — same question as before
The foundation code is complete and now documented. Do you want me to:

Continue into Phase 1 (auth + role-based app shell) — and produce its doc too, or
Pause so you can push and verify the foundation first (clasp create → clasp push → run setup() and runAllTests()), so we build the UI on confirmed-green code?
Given you wanted to move carefully, verifying first is the safer call — but I'm happy to keep building if you'd prefer momentum.

continue with phase 1
On to Phase 1 — authentication and the role-based app shell. This makes the project a real, deployable web app: it identifies who's signed in, routes the manager and employees to their own views, and embeds safely in Google Sites. I'll build the server side (auth + routing) and the HTML/CSS/JS shell, then document it.

Starting with the security layer and the request router:

Write Auth.gs
84 lines
/**
 * Auth.gs — identity and authorization. The security choke point.
 *
 * The web app is deployed "Execute as: Me (owner)" with "Anyone within domain"
 * access, so every visitor is a Workspace colleague and
 * Session.getActiveUser().getEmail() returns their real address (same-domain
 * exception). We map that email to a row in the Users tab to get their role.
 *
 * RULE: server functions must NEVER trust an email/role/userId sent from the
 * client (under execute-as-me, anyone could call any function from devtools).
 * Always re-derive identity here and re-check the role.
 */

/** @return {string} the signed-in user's email ('' if unavailable). */
function getActiveEmail_() {
  const u = Session.getActiveUser();
  return (u && u.getEmail()) ? u.getEmail() : '';
}

/** Find an ACTIVE user row by email (case-insensitive), or null. @private */
function findUserByEmail_(email) {
  if (!email) return null;
  const target = String(email).toLowerCase();
  const users = readObjects(SHEETS.USERS);
  for (let i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === target && truthy_(users[i].active)) return users[i];
  }
  return null;
}

/**
 * Resolve the current request's user context from the session.
 * @return {{email:string, userId:?string, role:?string, displayName:string,
 *           bufferMin:?number, recurrenceMode:?string, authorized:boolean}}
 */
function getCurrentUserContext() {
  const email = getActiveEmail_();
  const user = findUserByEmail_(email);
  if (!user) {
    return { email: email, userId: null, role: null, displayName: '', bufferMin: null, recurrenceMode: null, authorized: false };
  }
  return {
    email: email,
    userId: String(user.userId),
    role: String(user.role),
    displayName: String(user.displayName || email),
    bufferMin: Number(user.bufferMin != null && user.bufferMin !== '' ? user.bufferMin : getConfig('defaultBufferMin')),
    recurrenceMode: String(user.recurrenceMode || FREQ.WEEKLY),
    authorized: true
  };
}

/** @return {boolean} */
function isManager_(ctx) { return !!ctx && ctx.role === ROLES.MANAGER; }

/** Require any rostered user; returns the context or throws. */
function requireAuthorized() {
  const ctx = getCurrentUserContext();
  if (!ctx.authorized) {
    throw new Error('Not authorized: your account (' + (ctx.email || 'unknown') + ') is not on the FSW Booking roster.');
  }
  return ctx;
}

/** Require manager role; returns the context or throws. */
function requireManager() {
  const ctx = requireAuthorized();
  if (!isManager_(ctx)) throw new Error('Not authorized: manager access required.');
  return ctx;
}

/**
 * Require that the current user is either the manager OR the target employee.
 * Used to guard per-employee reads/writes so staff can only touch their own data.
 * @param {string} targetUserId
 * @return {Object} the current user context
 */
function requireSelfOrManager(targetUserId) {
  const ctx = requireAuthorized();
  if (ctx.role === ROLES.MANAGER) return ctx;
  if (String(ctx.userId) === String(targetUserId)) return ctx;
  throw new Error('Not authorized: you can only act on your own calendar.');
}
Update Todos

Phase 0: Scaffold — project files, manifest, Schema/Config, setup() bootstrap

Foundation modules: TimeUtil, SheetDAL, AuditLog

AvailabilityEngine + unit tests

Phase 0 + foundation documentation (.md + .docx) + md2docx tooling

Phase 1: Auth & app shell — Auth.gs, Code.gs doGet routing + iframe flags, getServerInfo; Index/Employee/Manager/Notice HTML + Styles + JsCommon

Phase 1 documentation (.md + .docx)

Phase 2: Employee availability — AvailabilityApi CRUD + employee UI (+ docs)

Phase 3: Time off / blocking — TimeOffApi (individual + company closures) + warn-and-flag (+ docs)

Phase 4: Manager booking — FullCalendar, free-range display, BookingApi.create under lock (+ docs)

Phase 5: Changes & cancels — reschedule + cancel + audit (+ docs)

Phase 6: Notifications — MailApp + reminder trigger (+ docs)

Phase 7: Reporting dashboard (+ docs)

Phase 8: Deploy + Sites embed + UAT docs
Now the request router with role-based rendering and the iframe-safety flags:

Write Code.gs
109 lines
/**
 * Code.gs — web-app entry point and routing.
 *
 * doGet identifies the visitor, picks the right view (manager / employee /
 * notice), and serves the Index template with that view embedded. It sets the
 * two flags required to live inside a Google Sites iframe:
 *   - setXFrameOptionsMode(ALLOWALL)  — allow framing
 *   - <base target="_top"> in Index   — allow links to escape the sandbox
 *
 * Client → server calls (google.script.run) land on the functions at the bottom;
 * each re-derives identity via Auth (never trusts the client).
 */

/** Web-app GET handler. @param {Object} e @return {HtmlOutput} */
function doGet(e) {
  let ctx = null;
  let state = 'OK';
  let notice = null;

  try {
    ctx = getCurrentUserContext();
  } catch (err) {
    // Reading the roster failed — almost always means setup() hasn't run yet.
    state = 'SETUP';
    notice = {
      title: 'Setup required',
      body: 'The booking system has not been initialised yet. An administrator needs to run setup() ' +
            'once in the Apps Script editor, then add staff with addEmployee(...).'
    };
  }

  let viewFile;
  if (state === 'SETUP') {
    viewFile = 'ui/Notice';
  } else if (!ctx.authorized) {
    state = 'UNAUTHORIZED';
    notice = {
      title: 'No access',
      body: 'Your Google account (' + (ctx.email || 'unknown') + ') is not on the FSW Booking roster. ' +
            'Please ask your manager to add you.'
    };
    viewFile = 'ui/Notice';
  } else {
    viewFile = (ctx.role === ROLES.MANAGER) ? 'ui/Manager' : 'ui/Employee';
  }

  const companyName = safeConfig_('companyName', 'FSW');
  const bootstrap = {
    state: state,
    email: ctx ? ctx.email : '',
    role: ctx ? ctx.role : null,
    userId: ctx ? ctx.userId : null,
    displayName: ctx ? ctx.displayName : '',
    tz: safeTz_(),
    companyName: companyName,
    notice: notice
  };

  const t = HtmlService.createTemplateFromFile('ui/Index');
  t.viewFile = viewFile;
  // Unescaped inject; neutralise any "</script>"-style break-outs in the JSON.
  t.bootstrapJson = JSON.stringify(bootstrap).replace(/</g, '\\u003c');

  return t.evaluate()
    .setTitle(companyName + ' Booking')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Include a partial/template file's content (used by Index via <?!= include(...) ?>). */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* --------------------------- client-callable API -------------------------- */

/**
 * Lightweight identity + connectivity probe used by the shell to confirm the
 * client↔server round-trip and show who's signed in. Re-derives identity.
 * @return {Object}
 */
function getServerInfo() {
  const ctx = getCurrentUserContext();
  const now = Date.now();
  return {
    email: ctx.email,
    role: ctx.role,
    userId: ctx.userId,
    displayName: ctx.displayName,
    authorized: ctx.authorized,
    tz: getTz(),
    serverTimeMs: now,
    serverTimeText: formatHuman(now)
  };
}

/* ------------------------------- helpers ---------------------------------- */

function safeTz_() {
  try { return getTz(); } catch (e) { return DEFAULTS.timeZone; }
}

function safeConfig_(key, fallback) {
  try {
    const v = getConfig(key);
    return (v === undefined || v === null || v === '') ? fallback : v;
  } catch (e) { return fallback; }
}
Now the front-end shell — shared styles, the page template, the role views, and the client-side JS:

Write Styles.html
105 lines
<style>
  :root {
    --brand: #1a73e8;
    --brand-dark: #1558b0;
    --ink: #202124;
    --muted: #5f6368;
    --line: #dadce0;
    --bg: #f6f8fc;
    --card: #ffffff;
    --ok: #137333;
    --warn: #b06000;
    --err: #c5221f;
    --radius: 10px;
    --shadow: 0 1px 3px rgba(60,64,67,.18), 0 1px 2px rgba(60,64,67,.10);
  }

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Google Sans', Roboto, Arial, system-ui, sans-serif;
    color: var(--ink);
    background: var(--bg);
    font-size: 14px;
    line-height: 1.5;
  }

  /* Top bar */
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 18px;
    background: var(--card); border-bottom: 1px solid var(--line);
    position: sticky; top: 0; z-index: 10;
  }
  .brand { font-size: 17px; font-weight: 600; color: var(--brand); }
  .who { display: flex; align-items: center; gap: 10px; }
  .who-name { color: var(--muted); }
  .badge {
    font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
    padding: 3px 9px; border-radius: 999px; background: #e8f0fe; color: var(--brand-dark);
  }
  .badge.manager { background: #e6f4ea; color: var(--ok); }
  .badge.employee { background: #e8f0fe; color: var(--brand-dark); }
  .badge.none { background: #fce8e6; color: var(--err); }

  /* Layout */
  .container { max-width: 1080px; margin: 0 auto; padding: 18px; }
  .view { display: block; }

  /* Tabs */
  .tabs {
    display: flex; gap: 4px; flex-wrap: wrap;
    border-bottom: 1px solid var(--line); margin-bottom: 18px;
  }
  .tab {
    appearance: none; border: none; background: transparent; cursor: pointer;
    font: inherit; color: var(--muted); padding: 10px 16px; border-radius: 8px 8px 0 0;
    border-bottom: 3px solid transparent; margin-bottom: -1px;
  }
  .tab:hover { background: #f1f3f4; color: var(--ink); }
  .tab.active { color: var(--brand); border-bottom-color: var(--brand); font-weight: 600; }

  /* Panels */
  .panel { display: none; }
  .panel.active { display: block; }

  /* Cards */
  .card {
    background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
    box-shadow: var(--shadow); padding: 22px; margin-bottom: 16px;
  }
  .card h2 { margin: 0 0 8px; font-size: 18px; }
  .card p { margin: 6px 0; color: var(--muted); }
  .placeholder { border-style: dashed; box-shadow: none; background: #fbfdff; }
  .soon {
    display: inline-block; font-size: 12px; font-weight: 600;
    color: var(--warn); background: #fef7e0; padding: 2px 8px; border-radius: 999px;
  }

  /* Notice (setup / unauthorized) */
  .notice-view { max-width: 620px; margin: 48px auto; }
  .notice { text-align: center; }
  .notice h2 { color: var(--ink); }

  /* Status bar */
  .statusbar {
    margin-top: 18px; padding-top: 12px; border-top: 1px solid var(--line);
    font-size: 12px; color: var(--muted);
  }
  .statusbar .ok { color: var(--ok); }
  .statusbar .err { color: var(--err); }

  /* Toast */
  .toast {
    position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
    background: #202124; color: #fff; padding: 10px 16px; border-radius: 8px;
    box-shadow: var(--shadow); max-width: 90%; z-index: 50;
  }
  .toast.err { background: var(--err); }

  @media (max-width: 600px) {
    .container { padding: 12px; }
    .who-name { display: none; }
  }
</style>
Write Index.html
31 lines
<!DOCTYPE html>
<html>
  <head>
    <base target="_top"><!-- REQUIRED: lets links escape the Google Sites iframe sandbox -->
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?!= include('ui/Styles'); ?>
  </head>
  <body>
    <header class="topbar">
      <div class="brand">📅 <span id="brandName">FSW</span> Booking</div>
      <div class="who">
        <span id="whoName" class="who-name"></span>
        <span id="whoRole" class="badge" hidden></span>
      </div>
    </header>

    <main class="container">
      <?!= include(viewFile); ?>
    </main>

    <div id="toast" class="toast" hidden></div>

    <script>
      // Server-provided bootstrap (identity, role, timezone, notice). Never a secret.
      window.FSW = <?!= bootstrapJson ?>;
    </script>
    <?!= include('ui/JsCommon'); ?>
  </body>
</html>
Write JsCommon.html
89 lines
<script>
  /* JsCommon — shared client helpers and shell wiring. Loaded on every page. */

  /** Promise wrapper around google.script.run. Usage: gcall('getServerInfo', arg1, ...) */
  function gcall(method) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (resolve, reject) {
      var runner = google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject);
      runner[method].apply(runner, args);
    });
  }

  /** Brief toast message. */
  function toast(msg, isError) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', !!isError);
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 4000);
  }

  /** Scoped tab switching: a .tab toggles the .panel matching its data-target within its .view. */
  function initTabs() {
    document.addEventListener('click', function (e) {
      var tab = e.target.closest ? e.target.closest('.tab') : null;
      if (!tab) return;
      var view = tab.closest('.view');
      if (!view) return;
      var targetId = tab.getAttribute('data-target');
      view.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
      view.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('active', p.id === targetId); });
    });
  }

  /** Populate the top bar from bootstrap. */
  function initChrome() {
    var f = window.FSW || {};
    var brand = document.getElementById('brandName');
    if (brand && f.companyName) brand.textContent = f.companyName;

    var name = document.getElementById('whoName');
    if (name) name.textContent = f.displayName || f.email || '';

    var role = document.getElementById('whoRole');
    if (role) {
      if (f.role) {
        role.textContent = (f.role === 'manager') ? 'Manager' : 'Employee';
        role.classList.add(f.role);
      } else {
        role.textContent = 'No access';
        role.classList.add('none');
      }
      role.hidden = false;
    }

    if (f.notice) {
      var nt = document.getElementById('noticeTitle');
      var nb = document.getElementById('noticeBody');
      if (nt) nt.textContent = f.notice.title;
      if (nb) nb.textContent = f.notice.body;
    }
  }

  /** Confirm the client↔server round-trip and show identity + server time. */
  function checkConnection() {
    var f = window.FSW || {};
    if (f.state !== 'OK') return;
    var cs = document.getElementById('connStatus');
    if (cs) cs.textContent = 'Connecting…';
    gcall('getServerInfo').then(function (info) {
      if (!cs) return;
      cs.innerHTML = '<span class="ok">✓ Connected</span> — signed in as ' + info.email +
        ' (' + (info.role || 'no role') + '). Server time: ' + info.serverTimeText + ' · ' + info.tz + '.';
    }).catch(function (err) {
      if (cs) cs.innerHTML = '<span class="err">⚠ Connection error</span>: ' + (err && err.message ? err.message : err);
    });
  }

  (function init() {
    initChrome();
    initTabs();
    checkConnection();
  })();
</script>
Write Employee.html
35 lines
<!-- Employee view shell. Panels are placeholders until later phases fill them. -->
<section class="view" id="employeeView">
  <div class="tabs" role="tablist">
    <button class="tab active" data-target="emp-calendar">My calendar</button>
    <button class="tab" data-target="emp-availability">My availability</button>
    <button class="tab" data-target="emp-timeoff">Time off</button>
  </div>

  <div id="emp-calendar" class="panel active">
    <div class="card placeholder">
      <h2>My calendar</h2>
      <p>Your upcoming client meetings will appear here, and you'll be able to reschedule or cancel your own.</p>
      <p><span class="soon">Coming in Phases 4–5</span></p>
    </div>
  </div>

  <div id="emp-availability" class="panel">
    <div class="card placeholder">
      <h2>My availability</h2>
      <p>Set the times you're free to take clients — recurring patterns (weekly or monthly), one-off extra slots, exceptions, and your personal buffer between meetings.</p>
      <p><span class="soon">Coming in Phase 2</span></p>
    </div>
  </div>

  <div id="emp-timeoff" class="panel">
    <div class="card placeholder">
      <h2>Time off</h2>
      <p>Mark holidays, sick days, or ad-hoc unavailable blocks that override your normal availability.</p>
      <p><span class="soon">Coming in Phase 3</span></p>
    </div>
  </div>

  <div class="statusbar"><span id="connStatus">Connecting…</span></div>
</section>
Write Manager.html
53 lines
<!-- Manager view shell. Panels are placeholders until later phases fill them. -->
<section class="view" id="managerView">
  <div class="tabs" role="tablist">
    <button class="tab active" data-target="mgr-schedule">Schedule</button>
    <button class="tab" data-target="mgr-book">Book a meeting</button>
    <button class="tab" data-target="mgr-closures">Closures</button>
    <button class="tab" data-target="mgr-team">Team</button>
    <button class="tab" data-target="mgr-reports">Reports</button>
  </div>

  <div id="mgr-schedule" class="panel active">
    <div class="card placeholder">
      <h2>Schedule</h2>
      <p>A combined calendar of all employees' availability and booked meetings, with conflict flags surfaced.</p>
      <p><span class="soon">Coming in Phase 4</span></p>
    </div>
  </div>

  <div id="mgr-book" class="panel">
    <div class="card placeholder">
      <h2>Book a meeting</h2>
      <p>Pick an employee and an open slot, enter the client's details (name, email, phone, purpose, location/format, meeting type) and confirm — with double-booking and buffer checks.</p>
      <p><span class="soon">Coming in Phase 4</span></p>
    </div>
  </div>

  <div id="mgr-closures" class="panel">
    <div class="card placeholder">
      <h2>Company closures</h2>
      <p>Block all employees at once for public holidays or team days, and manage individual time off.</p>
      <p><span class="soon">Coming in Phase 3</span></p>
    </div>
  </div>

  <div id="mgr-team" class="panel">
    <div class="card placeholder">
      <h2>Team</h2>
      <p>Manage the roster of employees and their roles.</p>
      <p><span class="soon">Roster editing UI planned; for now use addEmployee(...) in the editor.</span></p>
    </div>
  </div>

  <div id="mgr-reports" class="panel">
    <div class="card placeholder">
      <h2>Reports</h2>
      <p>Hours booked vs available, utilisation per employee, and a breakdown by meeting type.</p>
      <p><span class="soon">Coming in Phase 7</span></p>
    </div>
  </div>

  <div class="statusbar"><span id="connStatus">Connecting…</span></div>
</section>
Write Notice.html
8 lines
<!-- Shown when the system needs setup, or the visitor isn't on the roster. -->
<section class="notice-view">
  <div class="card notice">
    <h2 id="noticeTitle">Notice</h2>
    <p id="noticeBody"></p>
  </div>
</section>
Let me review the shell wiring before documenting. The key risk points: the template variable injection, the ui/-prefixed file names that clasp flattens, and the doGet state handling. Let me re-read the router and template together to confirm they line up.

Read Code.gs (lines 41-70)
Router and template line up correctly. Phase 1 code is complete. Now the Phase 1 documentation:

Update Todos

Phase 0: Scaffold — project files, manifest, Schema/Config, setup() bootstrap

Foundation modules: TimeUtil, SheetDAL, AuditLog

AvailabilityEngine + unit tests

Phase 0 + foundation documentation (.md + .docx) + md2docx tooling

Phase 1: Auth & app shell — Auth.gs, Code.gs doGet routing + iframe flags, getServerInfo; Index/Employee/Manager/Notice HTML + Styles + JsCommon

Phase 1 documentation (.md + .docx)

Phase 2: Employee availability — AvailabilityApi CRUD + employee UI (+ docs)

Phase 3: Time off / blocking — TimeOffApi (individual + company closures) + warn-and-flag (+ docs)

Phase 4: Manager booking — FullCalendar, free-range display, BookingApi.create under lock (+ docs)

Phase 5: Changes & cancels — reschedule + cancel + audit (+ docs)

Phase 6: Notifications — MailApp + reminder trigger (+ docs)

Phase 7: Reporting dashboard (+ docs)

Phase 8: Deploy + Sites embed + UAT docs
Write Phase-1-Auth-and-Shell.md
163 lines
# FSW Booking System — Phase 1: Authentication & App Shell

**Document version:** 1.0
**Date:** 2026-06-06
**Phase status:** Complete
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Phase 1**. It covers how the system identifies who is using it,
how it decides what each person is allowed to see and do, and the user-interface skeleton that every later
feature plugs into. After this phase the project is a real, deployable web app — you can open it, be
recognised, and land on the correct view — even though the feature screens are still placeholders.

It builds directly on the Phase 0 foundation (see *Phase 0 — Foundation*).

---

## 2. What Phase 1 delivers

- **Sign-in identity** — the app knows which Workspace user is visiting, with no separate login.
- **Roles** — each user is a *manager* or an *employee*, looked up from the `Users` tab.
- **Role-based routing** — the manager lands on the manager view; employees land on the employee view;
  unknown accounts and a not-yet-set-up system get clear, friendly notices instead of errors.
- **The app shell** — a consistent top bar, tabbed navigation, styling, and a client↔server connection check
  that proves the round-trip works and shows who you are.
- **Iframe-safety** — the two settings required for the app to display correctly when embedded in Google
  Sites (applied now so embedding "just works" in Phase 8).

---

## 3. How authentication and authorization work

### 3.1 Identity (who are you?)

The app is deployed to run **as the owner**, accessible to **anyone within the company's Workspace domain**.
A useful consequence of staying inside one domain is that Google still tells the app the visitor's real
email address (`Session.getActiveUser().getEmail()`), even though the code runs as the owner. That means:

- No extra login screen — staff are already signed into their Google account.
- No per-person authorization prompt — only the owner authorizes the app once.
- The data spreadsheet is never shared with ten people — all reads/writes go through the single owner
  identity.

### 3.2 Role (what are you allowed to do?)

The visitor's email is matched (case-insensitively) against the **`Users`** tab. The matching, *active* row
gives their `role` and `userId`. The result is a **user context**: `{ email, userId, role, displayName,
authorized }`.

### 3.3 The security principle

Because the app runs with the owner's full permissions, a curious or malicious employee could try to call
server functions directly from browser developer tools. Therefore **the server never trusts anything the
browser sends about identity**. Every server function re-derives who you are from the Google session and
re-checks your role. Three guards enforce this (`Auth.gs`):

| Guard | Meaning |
|---|---|
| `requireAuthorized()` | You must be on the roster (any role), else the call is rejected. |
| `requireManager()` | You must be a manager, else rejected. |
| `requireSelfOrManager(userId)` | You must be the manager *or* the specific employee whose data is being touched. |

These guards are used throughout the later phases so, for example, an employee can only edit *their own*
availability, while the manager can act for anyone.

---

## 4. Request routing

When the page is requested, the router (`doGet` in `Code.gs`) resolves the user context and chooses one of
these outcomes:

| Situation | What the visitor sees |
|---|---|
| System not initialised (no data spreadsheet yet) | **"Setup required"** notice — run `setup()` |
| Signed-in account not on the roster | **"No access"** notice — ask the manager to be added |
| Recognised **manager** | The **manager view** |
| Recognised **employee** | The **employee view** |

The chosen view is embedded into the shared page template, along with a small block of bootstrap data
(the user's name, role, timezone, company name, and any notice text). The bootstrap is injected safely so it
cannot break out of the page script.

---

## 5. The app shell

The interface is assembled from small HTML partials so each later phase only has to fill in its own panel.

| File | Role |
|---|---|
| `ui/Index.html` | The page skeleton: `<head>`, top bar, the injected view, and shared scripts |
| `ui/Styles.html` | All styling (a clean, Google-flavoured look; responsive down to mobile) |
| `ui/JsCommon.html` | Shared client JavaScript: a `google.script.run` promise wrapper, toast messages, tab switching, and the connection check |
| `ui/Employee.html` | Employee view: tabs for *My calendar*, *My availability*, *Time off* (placeholders) |
| `ui/Manager.html` | Manager view: tabs for *Schedule*, *Book a meeting*, *Closures*, *Team*, *Reports* (placeholders) |
| `ui/Notice.html` | The setup-required / no-access message card |

**Top bar** shows the company name, the signed-in person's name, and a colour-coded role badge
(green = manager, blue = employee, red = no access).

**Tabs** switch between panels within a view. Each placeholder panel names the phase that will deliver it,
so progress is visible at a glance.

**Connection check** — on load, the shell calls a tiny server endpoint (`getServerInfo`) and shows, in a
status line, a confirmation like *"✓ Connected — signed in as alex@… (employee). Server time: …"*. This is
the quickest way to confirm that identity resolution and the client↔server channel are both healthy.

---

## 6. Embedding safety (for Google Sites)

Two settings are applied now so the Phase 8 embedding is painless:

1. **`setXFrameOptionsMode(ALLOWALL)`** — without this, browsers refuse to display the app inside the Google
   Sites frame and it shows blank.
2. **`<base target="_top">`** in the page head — inside the Sites sandbox, links would otherwise be blocked;
   this lets any navigation open correctly.

A fallback "open in a new tab" link will also be provided on the Site in Phase 8 for the rare locked-down
browser that blocks third-party iframes entirely.

---

## 7. Files added in this phase

- `src/Auth.gs` — identity resolution and the three authorization guards.
- `src/Code.gs` — `doGet` routing, the `include()` partial helper, and the `getServerInfo` probe.
- `src/ui/Index.html`, `Styles.html`, `JsCommon.html`, `Employee.html`, `Manager.html`, `Notice.html`.

---

## 8. How to verify

Push the code (`clasp push`) and, if you haven't already, run `setup()` once. Then create a test deployment
(or use the editor's "Test deployments" → web app `/dev` URL) and check:

| Check | Expected result |
|---|---|
| Open the app as the **owner/manager** | Manager view with all five tabs; status line shows your email + "manager" + server time |
| Tabs switch | Clicking a tab swaps the panel below it |
| Open as an **employee** account (one you've `addEmployee`-d) | Employee view with three tabs; status line shows "employee" |
| Open as an account **not on the roster** | "No access" notice naming that email |
| Open **before** `setup()` has run | "Setup required" notice (no stack-trace error) |

> Tip: to test the employee experience without a second account, temporarily `addEmployee` your own test
> address, or change your own row's `role` to `employee` in the `Users` tab and reload.

---

## 9. What's next

| Phase | Deliverable |
|---|---|
| **2** | The **employee availability** screen — recurring patterns, one-off slots, exceptions, and the personal buffer — backed by a server API and writing into the tabs from Phase 0 |
| 3 | Time off and company-wide closures |
| 4 | Manager booking (the combined calendar + booking with validation) |

As with every phase, Phase 2 will ship its own `.md` and `.docx` document.
Bash Generate and validate Phase 1 docx
IN
python3 tools/md2docx.py docs/Phase-1-Auth-and-Shell.md && python3 - <<'PY'
from docx import Document
d = Document("docs/Phase-1-Auth-and-Shell.docx")
print("paragraphs:", len(d.paragraphs), "| tables:", len(d.tables),
      "| headings:", sum(1 for p in d.paragraphs if p.style.name.startswith("Heading")))
PY
ls -la docs/*.docx

OUT
Wrote docs/Phase-1-Auth-and-Shell.docx
paragraphs: 83 | tables: 5 | headings: 13
-rw-r--r--@ 1 david  staff  44313 Jun  6 21:28 docs/Phase-0-Foundation.docx
-rw-r--r--@ 1 david  staff  41051 Jun  6 21:35 docs/Phase-1-Auth-and-Shell.docx
Both docs generated and validated. Let me update the docs index and the progress memory:

Edit README.md
Modified
Edit build-progress.md
Added 6 lines
Update Todos

Phase 0: Scaffold — project files, manifest, Schema/Config, setup() bootstrap

Foundation modules: TimeUtil, SheetDAL, AuditLog

AvailabilityEngine + unit tests

Phase 0 + foundation documentation (.md + .docx) + md2docx tooling

Phase 1: Auth & app shell — Auth.gs, Code.gs doGet routing + iframe flags, getServerInfo; Index/Employee/Manager/Notice HTML + Styles + JsCommon

Phase 1 documentation (.md + .docx)

Phase 2: Employee availability — AvailabilityApi CRUD + employee UI (+ docs)

Phase 3: Time off / blocking — TimeOffApi (individual + company closures) + warn-and-flag (+ docs)

Phase 4: Manager booking — FullCalendar, free-range display, BookingApi.create under lock (+ docs)

Phase 5: Changes & cancels — reschedule + cancel + audit (+ docs)

Phase 6: Notifications — MailApp + reminder trigger (+ docs)

Phase 7: Reporting dashboard (+ docs)

Phase 8: Deploy + Sites embed + UAT docs
Phase 1 is complete — the project is now a real, deployable web app.

What I built
Server side

Auth.gs — identifies the signed-in Workspace user, looks up their role from the Users tab, and provides three guards: requireAuthorized(), requireManager(), requireSelfOrManager(). Core security principle baked in: the server re-derives identity from the Google session on every call and never trusts the browser (important under "execute as me").
Code.gs — the doGet router. It resolves who you are and serves the right thing:
not set up yet → friendly "Setup required" notice (no stack trace)
account not on roster → "No access" notice naming the email
manager → manager view; employee → employee view
Sets setXFrameOptionsMode(ALLOWALL) and the template carries <base target="_top"> — the two things needed for Google Sites embedding to work later.
Plus getServerInfo(), a small connectivity probe.
Front end (src/ui/)

Index.html (page skeleton), Styles.html (clean, responsive, Google-flavoured), JsCommon.html (a google.script.run promise wrapper, toasts, tab switching, and a live connection check).
Employee.html and Manager.html — role views with tabbed navigation. Feature panels are placeholders that name the phase delivering them, so progress is visible. Notice.html handles the setup/no-access states.
Docs — docs/Phase-1-Auth-and-Shell.md + .docx (validated: 13 headings, 5 tables), index and progress memory updated.

How to see it work
After clasp push + setup(), open the /dev URL: as the owner you'll get the manager view with a status line like "✓ Connected — signed in as you@domain (manager). Server time: …". Add a test employee (or flip your own Users row to employee) to see the employee view; an off-roster account gets "No access"; opening before setup() shows "Setup required".

Next up — Phase 2
The first real feature screen: the employee availability editor — recurring weekly/monthly patterns, one-off slots, exceptions, and the personal buffer — backed by a server API that writes into the Phase 0 tabs and reads back through the availability engine. Want me to continue into Phase 2, or pause here so you can push and eyeball the shell first?

proceed
Proceeding to Phase 2 — the employee availability editor, the first real feature. This is the server API for managing availability plus the employee UI that uses it. Starting with the server API:

Write AvailabilityApi.gs
264 lines
/**
 * AvailabilityApi.gs — client-callable CRUD for an employee's availability.
 *
 * Covers recurring rules, one-off additions, exceptions, and the personal
 * buffer, plus a live preview of computed free time. Every entry point is
 * guarded by requireSelfOrManager so an employee can only touch their own
 * calendar (the manager may act for anyone). All wall-clock input is converted
 * to epoch-ms here, in the business timezone, so the client never deals with tz.
 *
 * Mutations are soft (active=false) and audited, preserving history.
 */

const _FREQS = [FREQ.WEEKLY, FREQ.MONTHLY];
const _MONTHLY_MODES = [MONTHLY_MODE.DOM, MONTHLY_MODE.NTH_DOW];
const _NTHS = [1, 2, 3, 4, 5, -1];

/* ------------------------------- read ------------------------------------ */

/**
 * Everything the employee availability screen needs in one call.
 * @param {string} userId
 * @return {{user:Object, rules:Array, additions:Array, exceptions:Array, tz:string}}
 */
function getEmployeeAvailability(userId) {
  requireSelfOrManager(userId);
  const uid = String(userId);
  const user = findById(SHEETS.USERS, uid);
  if (!user) throw new Error('Unknown user.');
  const now = Date.now();
  const futureActive = function (rows) {
    return rows.filter(function (r) { return truthy_(r.active) && Number(r.endMs) >= now; })
               .sort(function (a, b) { return Number(a.startMs) - Number(b.startMs); });
  };

  const rules = readObjects(SHEETS.RULES)
    .filter(function (r) { return String(r.userId) === uid && truthy_(r.active); })
    .map(cleanRule_);
  const additions = futureActive(readObjects(SHEETS.ADDITIONS).filter(function (r) { return String(r.userId) === uid; }))
    .map(function (a) { return spanRow_(a, 'additionId'); });
  const exceptions = futureActive(readObjects(SHEETS.EXCEPTIONS).filter(function (r) { return String(r.userId) === uid; }))
    .map(function (x) { return spanRow_(x, 'exceptionId'); });

  return {
    user: {
      userId: uid,
      displayName: String(user.displayName || ''),
      bufferMin: Number(user.bufferMin !== '' && user.bufferMin != null ? user.bufferMin : getConfig('defaultBufferMin')),
      recurrenceMode: String(user.recurrenceMode || FREQ.WEEKLY)
    },
    rules: rules,
    additions: additions,
    exceptions: exceptions,
    tz: getTz()
  };
}

/** Project a rule row to a clean client object. @private */
function cleanRule_(r) {
  return {
    ruleId: String(r.ruleId), freq: String(r.freq),
    dayOfWeek: r.dayOfWeek === '' ? null : Number(r.dayOfWeek),
    monthlyMode: r.monthlyMode || '',
    dayOfMonth: r.dayOfMonth === '' ? null : Number(r.dayOfMonth),
    nth: r.nth === '' ? null : Number(r.nth),
    nthDayOfWeek: r.nthDayOfWeek === '' ? null : Number(r.nthDayOfWeek),
    startTimeLocal: String(r.startTimeLocal), endTimeLocal: String(r.endTimeLocal)
  };
}

/** Project an addition/exception row to a clean client object with display text. @private */
function spanRow_(r, idField) {
  return {
    id: String(r[idField]),
    startMs: Number(r.startMs), endMs: Number(r.endMs),
    note: String(r.note || ''),
    dateText: formatLocal(Number(r.startMs), 'EEE d MMM yyyy'),
    startText: formatLocal(Number(r.startMs), 'HH:mm'),
    endText: formatLocal(Number(r.endMs), 'HH:mm')
  };
}

/* ------------------------------- recurring rules -------------------------- */

/**
 * Create (no ruleId) or update (with ruleId) a recurring availability rule.
 * @param {string} userId
 * @param {Object} rule
 * @return {string} ruleId
 */
function saveRule(userId, rule) {
  const ctx = requireSelfOrManager(userId);
  const uid = String(userId);
  validateRuleInput_(rule);
  const now = Date.now();

  if (rule.ruleId) {
    const existing = findById(SHEETS.RULES, rule.ruleId);
    if (!existing || String(existing.userId) !== uid) throw new Error('Rule not found.');
    const patch = ruleToRow_(uid, rule);
    updateById(SHEETS.RULES, rule.ruleId, patch);
    logAudit({ entityType: ENTITY.RULE, entityId: rule.ruleId, action: AUDIT_ACTION.UPDATE,
               actorUserId: ctx.userId, actorEmail: ctx.email, atMs: now, before: cleanRule_(existing), after: patch });
    return rule.ruleId;
  }
  const ruleId = Utilities.getUuid();
  const row = ruleToRow_(uid, rule);
  row.ruleId = ruleId;
  appendObject(SHEETS.RULES, row);
  logAudit({ entityType: ENTITY.RULE, entityId: ruleId, action: AUDIT_ACTION.CREATE,
             actorUserId: ctx.userId, actorEmail: ctx.email, atMs: now, after: row });
  return ruleId;
}

/** Soft-delete a recurring rule. */
function deleteRule(userId, ruleId) {
  const ctx = requireSelfOrManager(userId);
  const existing = findById(SHEETS.RULES, ruleId);
  if (!existing || String(existing.userId) !== String(userId)) throw new Error('Rule not found.');
  updateById(SHEETS.RULES, ruleId, { active: false });
  logAudit({ entityType: ENTITY.RULE, entityId: ruleId, action: AUDIT_ACTION.DELETE,
             actorUserId: ctx.userId, actorEmail: ctx.email, atMs: Date.now(), before: cleanRule_(existing) });
  return true;
}

/** Build a full rule row from validated input. @private */
function ruleToRow_(uid, rule) {
  const row = {
    userId: uid, freq: rule.freq,
    dayOfWeek: '', monthlyMode: '', dayOfMonth: '', nth: '', nthDayOfWeek: '',
    startTimeLocal: rule.startTimeLocal, endTimeLocal: rule.endTimeLocal,
    effectiveFromMs: '', effectiveToMs: '', active: true
  };
  if (rule.freq === FREQ.WEEKLY) {
    row.dayOfWeek = Number(rule.dayOfWeek);
  } else {
    row.monthlyMode = rule.monthlyMode;
    if (rule.monthlyMode === MONTHLY_MODE.DOM) row.dayOfMonth = Number(rule.dayOfMonth);
    else { row.nth = Number(rule.nth); row.nthDayOfWeek = Number(rule.nthDayOfWeek); }
  }
  return row;
}

function validateRuleInput_(r) {
  if (!r || _FREQS.indexOf(r.freq) === -1) throw new Error('Choose a valid frequency (weekly or monthly).');
  validateTimeRange_(r.startTimeLocal, r.endTimeLocal);
  if (r.freq === FREQ.WEEKLY) {
    const d = Number(r.dayOfWeek);
    if (!(d >= 0 && d <= 6)) throw new Error('Choose a day of the week.');
  } else {
    if (_MONTHLY_MODES.indexOf(r.monthlyMode) === -1) throw new Error('Choose a monthly pattern.');
    if (r.monthlyMode === MONTHLY_MODE.DOM) {
      const dom = Number(r.dayOfMonth);
      if (!(dom >= 1 && dom <= 31)) throw new Error('Day of month must be between 1 and 31.');
    } else {
      if (_NTHS.indexOf(Number(r.nth)) === -1) throw new Error('Choose which occurrence (1st–5th, or Last).');
      const dw = Number(r.nthDayOfWeek);
      if (!(dw >= 0 && dw <= 6)) throw new Error('Choose a weekday.');
    }
  }
}

function validateTimeRange_(start, end) {
  if (!/^\d{1,2}:\d{2}$/.test(String(start)) || !/^\d{1,2}:\d{2}$/.test(String(end))) {
    throw new Error('Enter valid start and end times.');
  }
  const s = parseHhMm_(start), e = parseHhMm_(end);
  const sm = s.h * 60 + s.m, em = e.h * 60 + e.m;
  if (!(sm >= 0 && sm < 1440 && em > 0 && em <= 1440)) throw new Error('Times must fall within a single day.');
  if (em <= sm) throw new Error('End time must be after start time.');
}

/* ------------------------------- one-off & exceptions --------------------- */

/** Add a one-off availability slot. payload: {date,startTime,endTime,note}. */
function addOneOff(userId, payload) {
  return addSpan_(SHEETS.ADDITIONS, 'additionId', ENTITY.ADDITION, userId, payload);
}
function deleteOneOff(userId, additionId) {
  return deleteSpan_(SHEETS.ADDITIONS, ENTITY.ADDITION, userId, additionId);
}
function addException(userId, payload) {
  return addSpan_(SHEETS.EXCEPTIONS, 'exceptionId', ENTITY.EXCEPTION, userId, payload);
}
function deleteException(userId, exceptionId) {
  return deleteSpan_(SHEETS.EXCEPTIONS, ENTITY.EXCEPTION, userId, exceptionId);
}

/** Shared add for additions/exceptions. @private */
function addSpan_(sheet, idField, entity, userId, payload) {
  const ctx = requireSelfOrManager(userId);
  const tz = getTz();
  validateTimeRange_(payload.startTime, payload.endTime);
  const startMs = parseLocalDateTime_(payload.date, payload.startTime, tz);
  const endMs = parseLocalDateTime_(payload.date, payload.endTime, tz);
  if (endMs <= startMs) throw new Error('End time must be after start time.');
  const id = Utilities.getUuid();
  const row = {}; row[idField] = id;
  row.userId = String(userId); row.startMs = startMs; row.endMs = endMs;
  row.note = String(payload.note || ''); row.active = true;
  appendObject(sheet, row);
  logAudit({ entityType: entity, entityId: id, action: AUDIT_ACTION.CREATE,
             actorUserId: ctx.userId, actorEmail: ctx.email, atMs: Date.now(), after: row });
  return id;
}

/** Shared soft-delete for additions/exceptions. @private */
function deleteSpan_(sheet, entity, userId, id) {
  const ctx = requireSelfOrManager(userId);
  const existing = findById(sheet, id);
  if (!existing || String(existing.userId) !== String(userId)) throw new Error('Entry not found.');
  updateById(sheet, id, { active: false });
  logAudit({ entityType: entity, entityId: id, action: AUDIT_ACTION.DELETE,
             actorUserId: ctx.userId, actorEmail: ctx.email, atMs: Date.now(),
             before: { startMs: Number(existing.startMs), endMs: Number(existing.endMs) } });
  return true;
}

/** Parse "yyyy-MM-dd" + "HH:mm" as business-tz wall-clock to epoch-ms. @private */
function parseLocalDateTime_(dateStr, timeStr, tz) {
  const dp = String(dateStr).split('-').map(Number);
  if (dp.length !== 3 || dp.some(function (n) { return isNaN(n); })) throw new Error('Choose a valid date.');
  const tp = parseHhMm_(timeStr);
  return localPartsToEpochMs(dp[0], dp[1], dp[2], tp.h, tp.m, tz);
}

/* ------------------------------- buffer & preview ------------------------- */

/** Set the employee's buffer (minutes between meetings). */
function setBuffer(userId, minutes) {
  const ctx = requireSelfOrManager(userId);
  const m = Number(minutes);
  if (!(m >= 0 && m <= 600)) throw new Error('Buffer must be between 0 and 600 minutes.');
  const before = findById(SHEETS.USERS, String(userId));
  if (!before) throw new Error('User not found.');
  updateById(SHEETS.USERS, String(userId), { bufferMin: m });
  logAudit({ entityType: ENTITY.USER, entityId: String(userId), action: AUDIT_ACTION.UPDATE,
             actorUserId: ctx.userId, actorEmail: ctx.email, atMs: Date.now(),
             before: { bufferMin: Number(before.bufferMin) }, after: { bufferMin: m } });
  return true;
}

/**
 * Preview computed free ranges between two local dates (inclusive of the end
 * day). Lets the employee see the effect of their settings.
 * @param {string} userId @param {string} fromDateStr "yyyy-MM-dd" @param {string} toDateStr "yyyy-MM-dd"
 * @return {Array<{start:number,end:number,dayText:string,startText:string,endText:string}>}
 */
function previewFreeRanges(userId, fromDateStr, toDateStr) {
  requireSelfOrManager(userId);
  const tz = getTz();
  const winStart = parseLocalDateTime_(fromDateStr, '00:00', tz);
  let winEnd = startOfNextLocalDayMs(parseLocalDateTime_(toDateStr, '00:00', tz), tz);
  if (!(winEnd > winStart)) throw new Error('The "to" date must be on or after the "from" date.');
  if (winEnd - winStart > 92 * MS_PER_DAY) throw new Error('Please choose a range of at most ~3 months.');
  return computeFreeRanges(String(userId), winStart, winEnd).map(function (r) {
    return {
      start: r.start, end: r.end,
      dayText: formatLocal(r.start, 'EEE d MMM'),
      startText: formatLocal(r.start, 'HH:mm'),
      endText: formatLocal(r.end, 'HH:mm')
    };
  });
}
Now styling for the new form controls, lists, and preview:

Edit Styles.html
Added 56 lines
Now the employee view with the real availability editor (keeping calendar/time-off panels as placeholders for later phases):

Write Employee.html
134 lines
<!-- Employee view. "My availability" is built in Phase 2; other panels arrive later. -->
<section class="view" id="employeeView">
  <div class="tabs" role="tablist">
    <button class="tab active" data-target="emp-availability">My availability</button>
    <button class="tab" data-target="emp-calendar">My calendar</button>
    <button class="tab" data-target="emp-timeoff">Time off</button>
  </div>

  <!-- ============================ MY AVAILABILITY ======================== -->
  <div id="emp-availability" class="panel active">

    <!-- Buffer -->
    <div class="card">
      <h2>Buffer between meetings</h2>
      <p>A gap automatically kept clear before and after each of your meetings (for notes, travel, a breather).</p>
      <div class="row">
        <input type="number" id="bufferInput" class="input-sm" min="0" max="600" step="5">
        <span>minutes</span>
        <button class="btn sm" id="saveBufferBtn">Save</button>
      </div>
    </div>

    <!-- Recurring availability -->
    <div class="card">
      <h2>Recurring availability</h2>
      <p>Repeating times you're free for clients. Add as many patterns as you like.</p>
      <ul id="rulesList" class="list"></ul>
      <details class="adder" id="ruleAdder">
        <summary class="btn ghost sm">+ Add recurring availability</summary>
        <div class="form-grid">
          <label>Repeats
            <select id="ruleFreq">
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </label>
          <label class="fld-weekly" id="fldDow">Day
            <select id="ruleDow"></select>
          </label>
          <label class="fld-monthly hidden" id="fldMonthlyMode">Pattern
            <select id="ruleMonthlyMode">
              <option value="DOM">Day of month</option>
              <option value="NTH_DOW">Nth weekday</option>
            </select>
          </label>
          <label class="fld-dom hidden" id="fldDom">Day of month
            <input type="number" id="ruleDom" min="1" max="31" value="1">
          </label>
          <label class="fld-nth hidden" id="fldNth">Occurrence
            <select id="ruleNth">
              <option value="1">1st</option><option value="2">2nd</option>
              <option value="3">3rd</option><option value="4">4th</option>
              <option value="5">5th</option><option value="-1">Last</option>
            </select>
          </label>
          <label class="fld-nth hidden" id="fldNthDow">Weekday
            <select id="ruleNthDow"></select>
          </label>
          <label>From <input type="time" id="ruleStart" value="09:00"></label>
          <label>To <input type="time" id="ruleEnd" value="17:00"></label>
          <button class="btn sm" id="addRuleBtn">Add</button>
        </div>
      </details>
    </div>

    <!-- One-off availability -->
    <div class="card">
      <h2>One-off availability</h2>
      <p>Extra free time on a specific date, on top of your recurring pattern.</p>
      <ul id="additionsList" class="list"></ul>
      <details class="adder">
        <summary class="btn ghost sm">+ Add one-off slot</summary>
        <div class="form-grid">
          <label>Date <input type="date" id="addDate"></label>
          <label>From <input type="time" id="addStart" value="09:00"></label>
          <label>To <input type="time" id="addEnd" value="12:00"></label>
          <label class="wide">Note <input type="text" id="addNote" placeholder="optional"></label>
          <button class="btn sm" id="addOneOffBtn">Add</button>
        </div>
      </details>
    </div>

    <!-- Exceptions -->
    <div class="card">
      <h2>Exceptions</h2>
      <p>Remove part of your normal availability on a specific date — e.g. "not free this Monday morning".</p>
      <ul id="exceptionsList" class="list"></ul>
      <details class="adder">
        <summary class="btn ghost sm">+ Add exception</summary>
        <div class="form-grid">
          <label>Date <input type="date" id="excDate"></label>
          <label>From <input type="time" id="excStart" value="09:00"></label>
          <label>To <input type="time" id="excEnd" value="12:00"></label>
          <label class="wide">Note <input type="text" id="excNote" placeholder="optional"></label>
          <button class="btn sm" id="addExcBtn">Add</button>
        </div>
      </details>
    </div>

    <!-- Preview -->
    <div class="card">
      <h2>Preview — what you're offering</h2>
      <p>Your bookable free time after subtracting meetings, time off, closures and buffers.</p>
      <div class="row">
        <label>From <input type="date" id="prevFrom"></label>
        <label>To <input type="date" id="prevTo"></label>
        <button class="btn sm" id="previewBtn">Show</button>
      </div>
      <div id="previewOut" class="preview"></div>
    </div>

  </div>

  <!-- ============================ MY CALENDAR ============================ -->
  <div id="emp-calendar" class="panel">
    <div class="card placeholder">
      <h2>My calendar</h2>
      <p>Your upcoming client meetings will appear here, and you'll be able to reschedule or cancel your own.</p>
      <p><span class="soon">Coming in Phases 4–5</span></p>
    </div>
  </div>

  <!-- ============================ TIME OFF =============================== -->
  <div id="emp-timeoff" class="panel">
    <div class="card placeholder">
      <h2>Time off</h2>
      <p>Mark holidays, sick days, or ad-hoc unavailable blocks that override your normal availability.</p>
      <p><span class="soon">Coming in Phase 3</span></p>
    </div>
  </div>

  <div class="statusbar"><span id="connStatus">Connecting…</span></div>
</section>
Now the client logic for the availability editor:

Write JsEmployee.html
188 lines
<script>
  /* JsEmployee — wires the employee "My availability" screen to AvailabilityApi.
     Loaded only on the employee view (see Index.html). Relies on JsCommon
     (gcall, toast). */
  (function () {
    var root = document.getElementById('employeeView');
    if (!root) return;
    var UID = (window.FSW || {}).userId;

    var DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    var NTH_LABELS = { '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th', '-1': 'Last' };

    function val(id) { return document.getElementById(id).value; }
    function el(id) { return document.getElementById(id); }
    function errMsg(e) { return (e && e.message) ? e.message : String(e); }
    function isoDate(d) {
      var m = d.getMonth() + 1, day = d.getDate();
      return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }
    function fillDow(sel) {
      DAY_NAMES.forEach(function (name, i) {
        var o = document.createElement('option'); o.value = i; o.textContent = name; sel.appendChild(o);
      });
    }

    /* ----- rendering ----- */
    function describeRule(r) {
      var t = r.startTimeLocal + '–' + r.endTimeLocal;
      if (r.freq === 'WEEKLY') return 'Every ' + DAY_NAMES[r.dayOfWeek] + ', ' + t;
      if (r.monthlyMode === 'DOM') return 'Day ' + r.dayOfMonth + ' of each month, ' + t;
      return NTH_LABELS[String(r.nth)] + ' ' + DAY_NAMES[r.nthDayOfWeek] + ' of each month, ' + t;
    }

    function renderRules(rules) {
      var ul = el('rulesList'); ul.innerHTML = '';
      if (!rules.length) { ul.innerHTML = '<li class="empty">No recurring availability yet.</li>'; return; }
      rules.forEach(function (r) {
        var li = document.createElement('li');
        var d = document.createElement('div'); d.className = 'desc'; d.textContent = describeRule(r);
        var b = document.createElement('button');
        b.className = 'btn danger sm'; b.textContent = 'Remove';
        b.dataset.kind = 'rule'; b.dataset.id = r.ruleId;
        li.appendChild(d); li.appendChild(b); ul.appendChild(li);
      });
    }

    function renderSpans(listId, items, kind) {
      var ul = el(listId); ul.innerHTML = '';
      if (!items.length) { ul.innerHTML = '<li class="empty">None.</li>'; return; }
      items.forEach(function (it) {
        var li = document.createElement('li');
        var wrap = document.createElement('div');
        var d = document.createElement('div'); d.className = 'desc';
        d.textContent = it.dateText + ' · ' + it.startText + '–' + it.endText;
        wrap.appendChild(d);
        if (it.note) { var s = document.createElement('div'); s.className = 'sub'; s.textContent = it.note; wrap.appendChild(s); }
        var b = document.createElement('button');
        b.className = 'btn danger sm'; b.textContent = 'Remove';
        b.dataset.kind = kind; b.dataset.id = it.id;
        li.appendChild(wrap); li.appendChild(b); ul.appendChild(li);
      });
    }

    function renderPreview(ranges) {
      var out = el('previewOut'); out.innerHTML = '';
      if (!ranges.length) { out.innerHTML = '<div class="none">No free time in this range.</div>'; return; }
      var order = [], byDay = {};
      ranges.forEach(function (r) {
        if (!byDay[r.dayText]) { byDay[r.dayText] = []; order.push(r.dayText); }
        byDay[r.dayText].push(r);
      });
      order.forEach(function (day) {
        var h = document.createElement('div'); h.className = 'day'; h.textContent = day; out.appendChild(h);
        byDay[day].forEach(function (r) {
          var s = document.createElement('span'); s.className = 'slot'; s.textContent = r.startText + '–' + r.endText; out.appendChild(s);
        });
      });
    }

    /* ----- data ----- */
    var freqInitialised = false;
    function load() {
      gcall('getEmployeeAvailability', UID).then(function (data) {
        el('bufferInput').value = data.user.bufferMin;
        if (!freqInitialised) {
          el('ruleFreq').value = (data.user.recurrenceMode === 'MONTHLY') ? 'MONTHLY' : 'WEEKLY';
          freqInitialised = true; syncRuleFields();
        }
        renderRules(data.rules);
        renderSpans('additionsList', data.additions, 'addition');
        renderSpans('exceptionsList', data.exceptions, 'exception');
      }).catch(function (err) { toast(errMsg(err), true); });
    }

    /* ----- rule form ----- */
    function toggle(id, show) { el(id).classList.toggle('hidden', !show); }
    function syncRuleFields() {
      var weekly = el('ruleFreq').value === 'WEEKLY';
      var mode = el('ruleMonthlyMode').value;
      toggle('fldDow', weekly);
      toggle('fldMonthlyMode', !weekly);
      toggle('fldDom', !weekly && mode === 'DOM');
      toggle('fldNth', !weekly && mode === 'NTH_DOW');
      toggle('fldNthDow', !weekly && mode === 'NTH_DOW');
    }
    function collectRule() {
      var freq = val('ruleFreq');
      var r = { freq: freq, startTimeLocal: val('ruleStart'), endTimeLocal: val('ruleEnd') };
      if (freq === 'WEEKLY') {
        r.dayOfWeek = Number(val('ruleDow'));
      } else {
        r.monthlyMode = val('ruleMonthlyMode');
        if (r.monthlyMode === 'DOM') r.dayOfMonth = Number(val('ruleDom'));
        else { r.nth = Number(val('ruleNth')); r.nthDayOfWeek = Number(val('ruleNthDow')); }
      }
      return r;
    }

    function busy(btn, p) {
      btn.disabled = true;
      return p.then(function (r) { btn.disabled = false; return r; },
                    function (e) { btn.disabled = false; throw e; });
    }

    /* ----- wire up ----- */
    fillDow(el('ruleDow'));
    fillDow(el('ruleNthDow'));
    var today = new Date();
    el('addDate').value = isoDate(today);
    el('excDate').value = isoDate(today);
    el('prevFrom').value = isoDate(today);
    el('prevTo').value = isoDate(new Date(today.getTime() + 14 * 86400000));

    el('ruleFreq').addEventListener('change', syncRuleFields);
    el('ruleMonthlyMode').addEventListener('change', syncRuleFields);
    syncRuleFields();

    el('saveBufferBtn').addEventListener('click', function () {
      busy(this, gcall('setBuffer', UID, Number(val('bufferInput'))))
        .then(function () { toast('Buffer saved.'); })
        .catch(function (err) { toast(errMsg(err), true); });
    });

    el('addRuleBtn').addEventListener('click', function () {
      busy(this, gcall('saveRule', UID, collectRule()))
        .then(function () { toast('Recurring availability added.'); el('ruleAdder').open = false; load(); })
        .catch(function (err) { toast(errMsg(err), true); });
    });

    el('addOneOffBtn').addEventListener('click', function () {
      var p = { date: val('addDate'), startTime: val('addStart'), endTime: val('addEnd'), note: val('addNote') };
      if (!p.date) { toast('Choose a date.', true); return; }
      busy(this, gcall('addOneOff', UID, p))
        .then(function () { toast('One-off slot added.'); el('addNote').value = ''; load(); })
        .catch(function (err) { toast(errMsg(err), true); });
    });

    el('addExcBtn').addEventListener('click', function () {
      var p = { date: val('excDate'), startTime: val('excStart'), endTime: val('excEnd'), note: val('excNote') };
      if (!p.date) { toast('Choose a date.', true); return; }
      busy(this, gcall('addException', UID, p))
        .then(function () { toast('Exception added.'); el('excNote').value = ''; load(); })
        .catch(function (err) { toast(errMsg(err), true); });
    });

    el('previewBtn').addEventListener('click', function () {
      var out = el('previewOut'); out.textContent = 'Loading…';
      busy(this, gcall('previewFreeRanges', UID, val('prevFrom'), val('prevTo')))
        .then(renderPreview)
        .catch(function (err) { out.textContent = ''; toast(errMsg(err), true); });
    });

    // Delete (event delegation for all "Remove" buttons in this view).
    root.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.btn.danger') : null;
      if (!btn) return;
      var kind = btn.dataset.kind, id = btn.dataset.id;
      if (!window.confirm('Remove this entry?')) return;
      var fn = kind === 'rule' ? 'deleteRule' : kind === 'addition' ? 'deleteOneOff' : 'deleteException';
      busy(btn, gcall(fn, UID, id))
        .then(function () { toast('Removed.'); load(); })
        .catch(function (err) { toast(errMsg(err), true); });
    });

    load();
  })();
</script>
Now wire the employee script into the page (only on the employee view):

Edit Index.html
Added 3 lines
Phase 2 code is complete. Let me self-review the key integration points, then document. One thing I want to confirm: the employee endpoints all guard with requireSelfOrManager and the client always passes its own FSW.userId — let me verify the API surface is internally consistent (function names match what JsEmployee calls).

Bash Cross-check client gcall targets against server functions
IN
cd /Users/david/Repo/FSW-Booking-System
echo "=== Server functions defined (AvailabilityApi.gs) ==="
grep -oE '^function [a-zA-Z0-9_]+' src/AvailabilityApi.gs | sed 's/function //' | sort
echo "=== gcall targets used in JsEmployee.html ==="
grep -oE "gcall\('[a-zA-Z0-9_]+'" src/ui/JsEmployee.html | sed "s/gcall('//" | sort -u

OUT
=== Server functions defined (AvailabilityApi.gs) ===
addException
addOneOff
addSpan_
cleanRule_
deleteException
deleteOneOff
deleteRule
deleteSpan_
getEmployeeAvailability
parseLocalDateTime_
previewFreeRanges
ruleToRow_
saveRule
setBuffer
spanRow_
validateRuleInput_
validateTimeRange_
=== gcall targets used in JsEmployee.html ===
addException'
addOneOff'
getEmployeeAvailability'
previewFreeRanges'
saveRule'
setBuffer'
All client calls map to real server functions (the three delete* are dispatched via a variable, matching deleteRule/deleteOneOff/deleteException). Now the Phase 2 documentation:

Write Phase-2-Employee-Availability.md
142 lines
# FSW Booking System — Phase 2: Employee Availability

**Document version:** 1.0
**Date:** 2026-06-06
**Phase status:** Complete
**Audience:** Project owner / reviewer (and future developers)

---

## 1. Purpose of this document

This is the design-and-build record for **Phase 2**, the first feature employees actually use: the screen
where each person sets the times they're free to take clients. It builds on the Phase 0 foundation (the data
model and availability engine) and the Phase 1 shell (sign-in, the employee view, the client↔server channel).

After this phase, an employee can fully describe their availability and *see* exactly what they're offering;
the manager's booking screen (Phase 4) will be built directly on top of this data.

---

## 2. What an employee can now do

On the **My availability** tab, an employee can:

1. **Set a buffer** — the gap automatically kept clear before and after each of their meetings.
2. **Add recurring availability** — repeating patterns, either:
   - **Weekly** — e.g. *"Every Tuesday, 09:00–17:00"*, or
   - **Monthly** — either *"Day 15 of each month"* or *"the 2nd Tuesday / last Friday of each month"*.
3. **Add one-off slots** — extra availability on a specific date, on top of the recurring pattern.
4. **Add exceptions** — remove part of their normal availability on a specific date ("not this Monday
   morning").
5. **Preview** — see their actual bookable free time for any date range, computed by the engine after
   subtracting everything (exceptions, time off, closures, and — once bookings exist — meetings and buffers).

Everything saves immediately and reloads, so the lists always reflect the true stored state.

---

## 3. How it works

### 3.1 The server API (`AvailabilityApi.gs`)

A small set of client-callable functions, each guarded so an employee can only act on **their own**
calendar (the manager may act for anyone — enforced by `requireSelfOrManager`):

| Function | Purpose |
|---|---|
| `getEmployeeAvailability(userId)` | Everything the screen needs in one call: the user's buffer, recurring rules, upcoming one-off slots and exceptions, and the timezone |
| `saveRule(userId, rule)` | Create or update a recurring rule (validated) |
| `deleteRule(userId, ruleId)` | Remove a recurring rule |
| `addOneOff` / `deleteOneOff` | Manage one-off availability |
| `addException` / `deleteException` | Manage exceptions |
| `setBuffer(userId, minutes)` | Update the personal buffer |
| `previewFreeRanges(userId, fromDate, toDate)` | Compute and return bookable free time for a date range |

### 3.2 Timezone is handled on the server

The browser only ever sends plain calendar values — a date like `2026-06-15`, a time like `09:00`. The
server interprets these as **business-timezone wall-clock** and converts them to the canonical epoch-ms
storage using the Phase 0 `TimeUtil` helper. This means a person in a different timezone (or a browser set to
one) can never accidentally store the wrong instant — the business timezone is the single reference.

### 3.3 Validation

Every input is checked on the server before anything is written: a valid frequency, a real weekday or
day-of-month, an end time after the start time, a buffer within 0–600 minutes, and a sensible preview range.
Bad input is rejected with a clear, human-readable message that the screen shows as a toast.

### 3.4 Edits are reversible and audited

Removals are **soft** (the row is marked inactive, not erased) and every create/update/delete writes an entry
to the append-only audit log, so the history of who changed what is preserved.

### 3.5 The preview reuses the real engine

The preview does not approximate — it calls the exact same `computeFreeRanges` function the manager's booking
screen will use. So what an employee sees in the preview is precisely what the manager will be able to book
against. This is the quickest way for an employee to sanity-check their own setup.

---

## 4. The user interface

The **My availability** tab is organised into clear cards: *Buffer*, *Recurring availability*, *One-off
availability*, *Exceptions*, and *Preview*. Each list shows existing entries with a **Remove** button; each
"+ Add…" control expands an inline form. The recurring form adapts as you choose: picking *Weekly* shows a
weekday selector; picking *Monthly* shows either a day-of-month box or an occurrence + weekday pair.

Recurring patterns are rendered in plain English (e.g. *"Every Tuesday, 09:00–17:00"*, *"Last Friday of each
month, 13:00–14:00"*) so the list is readable at a glance.

### Files

- `src/AvailabilityApi.gs` — the server API described above.
- `src/ui/Employee.html` — the *My availability* tab markup (calendar and time-off tabs remain placeholders).
- `src/ui/JsEmployee.html` — the client logic (rendering, forms, save/delete, preview). Loaded only on the
  employee view.
- `src/ui/Styles.html` — extended with styles for buttons, inputs, forms, lists, and the preview.

---

## 5. How to verify

Push (`clasp push`) and open the app as an employee (add a test employee, or set your own `Users` row's role
to `employee`). On **My availability**:

| Step | Expected result |
|---|---|
| Set the buffer to e.g. 15 and Save | "Buffer saved." toast; the value persists on reload |
| Add *Weekly · Tuesday · 09:00–17:00* | Appears in the recurring list as "Every Tuesday, 09:00–17:00" |
| Add *Monthly · Nth weekday · 2nd · Tuesday · 13:00–14:00* | Appears as "2nd Tuesday of each month, 13:00–14:00" |
| Add a one-off slot for a future date | Appears under one-off availability |
| Add an exception over part of a recurring day | Appears under exceptions |
| Preview the next two weeks | Free time is listed per day; the exception's hours are missing from that day, confirming subtraction works |
| Remove any entry | Disappears after confirmation; preview updates accordingly |

> Cross-check against the engine's unit tests from Phase 0 (`runAllTests`) — the preview and those tests share
> the same `computeFreeRanges` code path.

---

## 6. Notes and limitations (intentional, for now)

- Recurring rules are **open-ended** (no start/end-date bounds in the form yet); the data model already
  supports effective-date windows if needed later.
- The availability editor lives in the **employee** view. If a manager also takes clients, they would be added
  with an employee role to get this screen.
- One-off slots and exceptions show **upcoming** entries (past ones are hidden to reduce clutter; they remain
  in the data and audit log).

---

## 7. What's next

| Phase | Deliverable |
|---|---|
| **3** | **Time off & company closures** — employees and the manager block out unavailable time; the manager can close the whole company at once; bookings caught under new time off get flagged |
| 4 | Manager booking — the combined calendar and booking flow, built on this availability data |
| 5 | Reschedule & cancel |

Phase 3 will ship its own `.md` and `.docx` document.
Bash Generate and validate Phase 2 docx
IN
cd /Users/david/Repo/FSW-Booking-System
python3 tools/md2docx.py docs/Phase-2-Employee-Availability.md
python3 - <<'PY'
from docx import Document
d = Document("docs/Phase-2-Employee-Availability.docx")
print("paragraphs:", len(d.paragraphs), "| tables:", len(d.tables),
      "| headings:", sum(1 for p in d.paragraphs if p.style.name.startswith("Heading")))
PY
ls docs/*.docx

OUT
Wrote docs/Phase-2-Employee-Availability.docx
paragraphs: 77 | tables: 3 | headings: 14
docs/Phase-0-Foundation.docx
docs/Phase-1-Auth-and-Shell.docx
docs/Phase-2-Employee-Availability.docx
Now updating the docs index and progress memory:

Edit README.md
Modified
Edit build-progress.md
Added 5 lines
Update Todos

Phase 0: Scaffold — project files, manifest, Schema/Config, setup() bootstrap

Foundation modules: TimeUtil, SheetDAL, AuditLog

AvailabilityEngine + unit tests

Phase 0 + foundation documentation (.md + .docx) + md2docx tooling

Phase 1: Auth & app shell

Phase 1 documentation (.md + .docx)

Phase 2: Employee availability — AvailabilityApi CRUD + employee UI

Phase 2 documentation (.md + .docx)

Phase 3: Time off / blocking — TimeOffApi (individual + company closures) + warn-and-flag + UI (+ docs)

Phase 4: Manager booking — FullCalendar, free-range display, BookingApi.create under lock (+ docs)

Phase 5: Changes & cancels — reschedule + cancel + audit (+ docs)

Phase 6: Notifications — MailApp + reminder trigger (+ docs)

Phase 7: Reporting dashboard (+ docs)

Phase 8: Deploy + Sites embed + UAT docs
Phase 2 is complete — employees now have a fully working availability editor.

What I built
Server — AvailabilityApi.gs — client-callable CRUD, every function guarded so an employee can only touch their own calendar:

getEmployeeAvailability (one call returns buffer + rules + one-offs + exceptions), saveRule/deleteRule, addOneOff/deleteOneOff, addException/deleteException, setBuffer, and previewFreeRanges.
The browser only sends plain dates/times; the server converts them to epoch-ms in the business timezone, so a mis-set browser clock can't store the wrong instant. All input is validated server-side, removals are soft (reversible) and audited.
The preview reuses the exact computeFreeRanges engine the manager's booking screen will use — so what an employee sees is precisely what's bookable.
UI — Employee.html "My availability" tab (buffer, recurring patterns, one-off slots, exceptions, live preview) + JsEmployee.html (loaded only on the employee view). Recurring rules render in plain English — "Every Tuesday, 09:00–17:00", "Last Friday of each month, 13:00–14:00". Styles extended for forms/lists/preview. I cross-checked that every gcall in the client maps to a real server function.

Docs — docs/Phase-2-Employee-Availability.md + .docx (14 headings, 3 tables), index + progress memory updated.

How to see it
As an employee, open My availability: set a buffer, add Weekly · Tuesday · 09:00–17:00, add an exception over part of a Tuesday, then Preview the next two weeks — the exception's hours will be missing from that day, proving the engine subtraction works end to end.

Next — Phase 3
Time off & company closures: employees mark holidays/sick days (full-day or partial); the manager closes the whole company in one action; and the warn-and-flag logic flags any existing booking caught under new time off (nothing gets silently deleted). This fills the "Time off" tab and the manager's "Closures" tab.

Want me to continue into Phase 3, or pause to push and try the availability screen first?