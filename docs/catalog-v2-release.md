# Catalog v2 release

Owner revisions provide corrected dimensions and prices, confirm duplicate inventory, and add separately rentable slip-and-slides and obstacle-course sections. The catalog import preserves unit IDs, booking history and existing photos. Fire N Ice remains unavailable in both modes.

## Release order

1. Back up production inventory and photos; review existing confirmed bookings for any component conflicts. Historical requests keep their quoted prices. Existing Big Kahuna and Palmzilla IDs now represent the slide-with-pool option, so reconcile any earlier requests for standalone slip-and-slides before importing.
2. Apply `migrations/0003_shared_inventory.sql` after migrations 0001 and 0002.
3. Execute `seeds/seed_catalog_v2.sql` as one D1 batch. This is an idempotent import, not a reset. Do not reapply the superseded owner seed.
4. Deploy the Worker and public assets together. The two Sunset photos are served from versioned source assets through their existing media URLs.
5. Verify `/api/units`, Sunset photos, package/component availability, and the public policy copy. Confirm Fire N Ice is absent.

Wet/dry options and packages share physical components. Database triggers reject overlapping confirmed rentals atomically. Pending requests do not hold inventory. Owners can still rent two independent pieces on the same day.

## Payment and policy scope

A $100 deposit applies once per booking at $375 or more and is credited toward the balance. Rena provides payment instructions after approval. This release does not collect online payments or send payment links. The form still requests one rental option at a time; customers should contact Rena to combine multiple units into one booking and one deposit. Multi-unit subtotal interpretation remains to be confirmed.

Eight hours are guaranteed; additional hours and overnight arrangements require personal approval. No outdoor setup below 50 F, during thunderstorms, or with winds over 15 mph. Business cancellations refund the deposit. Customers are asked to give 48 hours' notice when possible; no customer-cancellation penalty or refund policy is invented. Tax handling is unchanged pending owner guidance.

## Validation

Run `npm test` and `npm run format:check`. Catalog tests cover repeat imports, preservation of photos, corrected option pricing, disabled rentals, shared date blocks and concurrent package/component confirmation conflicts.
