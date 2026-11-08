# UE5 System Architect — Accounts, Cloud Projects, Files & Teamwork

UE5 System Architect turns a plain-language description into a modular Unreal Engine 5 system: an event graph, Blueprint pseudocode, C++ files and a setup guide, all tunable with sliders and module toggles.
This update adds accounts, a cloud project library, file uploads the AI can read, and sharing, so teams can build on the same systems.

## Who it's for
- Solo UE5 developers who want their systems saved safely and available on any device.
- Small game teams (designers and programmers) who want to share a generated system, comment through notes and regenerate together.
- Leads who want to hand out read-only links to a system's code and setup guide.

## Core features and experience

**Sign-in**
- Two ways to sign in: Google, or email and password. If both use the same email address, they reach the same account.
- Email accounts include sign-up, sign-in, sign-out and password reset. Reset works by a link shown on screen, because email sending is not part of this phase.
- A built-in admin account exists for the app owner.
- The workspace requires sign-in. Visitors with a share link are the only exception.

**Cloud projects (replaces the browser-only library)**
- "My Library" becomes "Projects", saved to your account. There are two lists, "Mine" and "Shared with me".
- A project holds:
  - the latest generated system
  - the inputs that produced it: description, dials, Project Context, modules and notes
  - its files
- Save, rename, delete and open work as they do today, but in the cloud.
- **Export JSON** downloads the project. A new **Copy JSON** button copies it to the clipboard.
- **Import project** loads an exported .json file back in as a new project.
- **First sign-in:** if systems are saved in this browser, a prompt offers two choices. **Import them** copies them into the account. **Start fresh** keeps them in the browser only and stops asking.
- Stack Systems and Compare keep working with cloud projects.

**Reference files the AI reads**
- A paperclip on the description box lets you attach up to 5 files to the next synthesis. Accepted types are screenshots and images, PDFs, and code or text files (.h, .cpp, .txt, .md, .json).
- The AI uses them as source material, e.g. "extend this existing header" or "match this UI screenshot".
- Attached references are listed under the description and stay with the project for later regenerations. Each can be removed individually.

**Project files**
- A "Files" tab on each project, for anything the team wants to keep with the system, such as concept art, specs or exported code.
- Members can upload, download and delete files, according to their role.

**Teamwork**
- **Invite by email with roles.** The owner adds people by email as:
  - **Editor:** can change inputs, regenerate, upload files and save.
  - **Viewer:** can open, copy, export and download only.
- An invite is sent to an email address. The person sees the project under "Shared with me" as soon as they sign in with that email. The owner can also copy an invite link to send themselves.
- **View-only share links.** The owner can switch on a public link. Anyone with it can view, copy and export the system without signing in. The owner can switch the link off at any time.
- Each project shows who last saved it and when.
- If someone else saved while you were editing, you are warned before overwriting. You can then load their version or overwrite it.

## User flow
1. Open the app and sign in with Google or with email and password.
2. On first sign-in, choose to import browser-saved systems or start fresh.
3. Describe a system, optionally attach reference files, then Synthesize.
4. Tune, regenerate and compare. Save to a project.
5. Open the project's Share panel. Invite teammates as Editor or Viewer, or turn on a view-only link.
6. Teammates open it from "Shared with me", regenerate if they are Editors, and save. The project shows "last saved by".
7. Anyone with access can use Export JSON, Copy JSON or file downloads. Import project brings a .json back in.

## UI/UX feel
- The current dark Unreal Editor look stays: slate panels, Unreal orange accents and monospace details.
- The sign-in screen matches it, with a blueprint-grid background, the app mark, a Google button and an email form.
- The top bar gains the project name (editable in place), a Share button, a role badge (Owner, Editor or Viewer) and an account menu.
- Viewers see the same workspace, with editing controls disabled and a clear "View only" badge.
- Share and invite use a single modal: a member list with role dropdowns, an "add by email" field and the public-link switch with a Copy button.

## Implementation phases

**Phase 1 — MVP (built now)**
- Google and email/password sign-in, including password reset and the admin account.
- Cloud projects: save, open, rename, delete, "Mine" and "Shared with me" lists, last-saved-by, and the overwrite warning.
- Export JSON, Copy JSON and Import project from .json.
- A one-time offer to import browser-saved systems, or start fresh.
- Reference files the AI reads (images, PDFs, code and text), up to 5 per synthesis.
- A project Files tab with upload, download and delete.
- Invite by email with Editor and Viewer roles, plus view-only public share links.

**Phase 2 — Team depth**
- Team workspaces: create a team, and every member sees and edits all of the team's projects.
- Version history per project, so Compare works against any earlier version, not just the last one.
- Real invite and password-reset emails.
- Per-user monthly generation limits, set by the owner.

**Phase 3 — Integrations and polish**
- An AI model picker: Claude, Gemini or ChatGPT.
- Jev quick checks: flag vague descriptions before spending credits, and auto-tag projects by category with library filters.
- Project zip export containing the .h, .cpp and setup guide with its Why notes.
- Concept art per project from image generation.

## Suggestions folded into this plan
- **Overwrite warning and last-saved-by:** without these, two Editors would silently undo each other's work.
- **Per-user generation limits (Phase 2):** every synthesis by any user is paid from the app owner's Universal Key balance.
- **Version history (Phase 2):** this makes Compare much more useful for teams.

## Assumptions
- All three sharing styles you chose are kept. Email invites and public links are built in Phase 1, and team workspaces in Phase 2, to keep the first release focused.
- "Offer to import" and "Start fresh" are both kept, as the two choices of a single first-sign-in prompt.
- Invites and password resets do not send real emails in Phase 1. Invites match on the email address at sign-in, and both can be shared as copyable links.
- Every AI generation, by any signed-in user, is paid from the app owner's Emergent Universal Key.
- Only the owner can delete a project, change roles or toggle the public link. Editors can regenerate, save and manage files. Viewers can read, copy and export.
- Public share links are view-only and show the system and setup guide, but not project files.
- File limits: 10 MB per reference file and 25 MB per project file. Deleted files disappear from the app but are not recoverable by users.
- Browser-saved systems that are not imported remain in that browser only.
- Claude Sonnet 4.5 stays the generation model in Phase 1.
- Shared projects are not edited live together. Changes appear when a project is saved and reopened.
