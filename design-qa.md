# WP-04 Design QA

## Scope

- Simple shell: `/`
- Original advanced workspace: `/studio`
- Viewports: 360 × 800 and 1440 × 1000
- Routes reviewed: login, home, tasks, library, custom workflows, settings
- Languages reviewed: Traditional Chinese and English

## Automated and browser evidence

- Full Node test suite: 1,295 passed, 0 failed.
- Lighthouse mobile: Performance 97, Accessibility 100, Best Practices 100.
- Lighthouse metrics: FCP 0.9 s, LCP 2.6 s, TBT 0 ms, CLS 0, Speed Index 0.9 s.
- Simple-shell JavaScript payload: 80,059 characters, below the 150 KB work-package limit.
- Browser console: no unexpected errors. The remote-login check produced the expected unauthenticated `401` response.
- Responsive layout: no horizontal overflow at either reviewed viewport.
- Touch targets: no visible interactive target below 44 × 44 px at the reviewed mobile viewport.
- PWA assets, manifest, service worker, offline page, and licenses page load from local files without a CDN.

The Lighthouse JSON was written successfully. On Windows the CLI later reported an `EPERM` warning while removing its temporary Chrome directory; the completed report was retained and the exact orphaned temporary directory was verified and removed afterward.

## Findings resolved during QA

- Replaced a CSP-blocked inline progress style with a native progress element.
- Removed overlap between the unavailable-workflow warning and the fixed bottom action.
- Made all persistent navigation and menu labels update when the language changes.
- Increased compact controls to the 44 px mobile touch-target minimum.
- Removed the duplicate app bar from the login route and corrected the owner role label.
- Increased inactive navigation contrast and removed an accessible-name mismatch from the wordmark.
- Shortened the hardware label so it remains readable on a 360 px screen.
- Added every WP-04 mode-specific general field and capability-gated advanced control skeleton.
- Aligned the installed PWA start URL and scope with its isolated service worker.
- Made the anonymous analytics switch server-authoritative and fail closed when disabled.
- Added per-mode form drafts, keyboard viewport handling, haptic long-press feedback, inert sheets, Escape, and Android Back behavior.
- Added session-expiry handling plus delayed SSE-loss and two-second recovery banners.
- Added task ETA, submission time, last-known progress, details, cancellation payload correction, and queue reordering.
- Added the Library viewer and actions, destructive confirmation modal, and trash summary/permanent-empty flow.
- Added local QR generation and ranked physical LAN adapters ahead of WSL/Hyper-V adapters.
- Disabled generation during connection loss, synchronized the rendered control on network changes, and added a defensive offline action guard.

## Gate and known deferrals

- No unresolved P0 or P1 visual defect was found in automated desktop-browser QA.
- A physical Android review remains the WP-04 user gate before WP-05.
- The owner PIN has not been saved yet, so remote phone login remains intentionally blocked.
- Generation payload mapping is intentionally deferred to WP-05.
- Reviewed dependency/model installation is intentionally deferred to WP-06.
- MCWW workflow installation and status are intentionally deferred to WP-07.
- Per-item trash restore needs a backend trash index/restore API that is outside WP-04's three permitted server hooks; the shell does not pretend it is available.
