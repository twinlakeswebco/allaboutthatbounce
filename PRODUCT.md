# Product
<!-- impeccable:product-schema 1 -->
## Platform
web
## Stack
User-specified plain HTML, CSS, vanilla JavaScript; Cloudflare Workers static assets, no CMS. Cloudflare Worker backend: D1 for requests, inventory and settings; R2 for unit photos; Cloudflare Access protecting the admin page and admin API; Turnstile on public forms; Resend for email notifications.
## Users
Phone users requesting inflatable rentals for backyard parties, school, church and community events in Oldham, Shelby, Henry, Trimble and Jefferson counties, Kentucky (La Grange, Shelbyville and nearby); owner Rena Arnold managing requests and inventory. Grayson County is not served yet; leave it out of every service-area statement.
## Product Purpose
Simple inflatable rentals for that five-county area; a request becomes booked only after the owner confirms it.
## Capabilities and Constraints
Four public pages and a separate admin backed by the Worker API. Owner confirms every request; pending requests do not hold dates. Payment is cash or check at delivery; no advance deposit and no online payment. Canonical contact: allaboutthatbounce7596@gmail.com and 502-851-7596; Facebook page Allaboutthatbounceky. Private delivery origin never client-visible. No street address published. Logo and brand colors undecided.
## Brand Commitments
Playful, bubbly, colorful, clean; mobile first, 360px. Large tap targets, strong contrast, no unnecessary remote dependencies.
## Evidence on Hand
Owner discussion supplied. Real public content captured 2026-10-15 from the previous site, kept untracked in `aatb-website-reference/` and never deployed. Policies (payment, weather, power, setup, supervision) are sourced from that site's FAQ. Catalog prices are pending owner confirmation; see `seeds/seed_catalog_review.sql`, which is for review only. Uploaded private reference material must never be served as static assets.
