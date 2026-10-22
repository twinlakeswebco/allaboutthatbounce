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

Customers pay the full balance by cash or check at delivery, before setup. No advance payment is collected. Wet/dry pairs are presented together with a use selector; the selected existing option ID supplies the server price and shared component availability.

Eight hours are guaranteed; additional hours and overnight arrangements require personal approval. No outdoor setup below 50 F, during thunderstorms, or with winds over 15 mph. Customers are asked to give 48 hours' notice when possible. Setup takes 10–50 minutes depending on the rental. We send the delivery ETA the day before the event, sometimes as late as 10 p.m. Tax handling is unchanged pending owner guidance.

## Validation

Run `npm test` and `npm run format:check`. Catalog tests cover repeat imports, preservation of photos, corrected option pricing, disabled rentals, shared date blocks and concurrent package/component confirmation conflicts.
