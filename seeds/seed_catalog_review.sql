-- REVIEW-ONLY CATALOG. Not for production.
-- Captured from the old public rental page (allaboutthatbounceky.net/inflatables/) on 2026-10-15:
-- one row per rental-page listing (26). Booking-only cards (Purple Castle, Princess Combo,
-- Boxing Ring) are intentionally left out until the owner confirms them.
-- Do not run against the production database until the owner confirms prices, inventory,
-- capacities, and supervision requirements for every unit.
-- price_cents is the lowest standalone price listed; every other option is spelled out in the
-- description. size lists the rental page's dimensions, weight limit, age or height rule, rider
-- limit, and supervisor count as source claims; "dimensions pending" marks missing data.
-- Run locally only:
--   npx wrangler d1 execute allaboutthatbounce --local --file seeds/seed_catalog_review.sql
INSERT OR IGNORE INTO units (id,name,description,size,mode,price_cents,deposit_required,sort_order) VALUES
-- Bounce houses
('sports-castle','Sports Castle','A sports-themed bounce house with a built-in basketball hoop, so every jump can be a slam dunk. A home run for backyard birthdays.','13L × 14W × 15H ft · 150 lb per rider, 700 lb max · ages 12 and under · 1 adult supervisor','dry',16000,0,1),
('castle','Castle','A classic castle in bright primary colors that fits any party theme. Great for school carnivals, church events, and backyard birthdays.','13L × 15W × 15H ft · 150 lb per rider, 700 lb max · ages 12 and under · 1 adult supervisor','dry',16000,0,2),
('crayon-castle','Crayon Castle','A roomy 15 × 15 castle in cheerful crayon colors. Every kid at the party will want a turn.','15L × 15W × 15H ft · 150 lb per rider, 700 lb max · ages 15 and under · 1 adult supervisor','dry',16000,0,3),
('castle-2','Castle #2','Another roomy 15 × 15 castle, ready for carnivals, church events, and backyard birthdays.','15L × 15W × 15H ft · 150 lb per rider, 700 lb max · ages 15 and under · 1 adult supervisor','dry',16000,0,4),
('fortress-castle','Fortress Castle','A sturdy fortress built for big bouncing. It suits any occasion, from school carnivals to backyard birthdays.','Dimensions pending · 150 lb per rider, 700 lb max · ages 15 and under · 1 adult supervisor','dry',16000,0,5),
('ky-freedom-castle','KY Freedom Castle','A Kentucky-proud castle for birthdays, block parties, and every celebration in between.','Dimensions pending · 150 lb per rider, 700 lb max · ages 15 and under · 1 adult supervisor','dry',16000,0,6),
('orange-crush','Orange Crush','Our newest castle, bright as a pumpkin patch. Made for fall festivals and autumn birthdays.','Dimensions pending · 150 lb per rider, 700 lb max · ages 15 and under · 1 adult supervisor','dry',16000,0,7),
-- Combos
('combo-castle-1','Combo Castle #1','A big slide and a roomy jumping area in one castle. Dry $250 or wet $275.','13L × 32W × 15H ft · 750 lb max · 1 adult supervisor','dry',25000,0,8),
('castle-combo','Castle Combo','A 4-in-1 castle combo with a big slide and plenty of room to bounce. Dry $250 or wet $275.','25.6L × 15W × 14H ft · 200 lb per rider · ages 3 and up · 1 adult supervisor','dry',25000,0,9),
('combo-2','Combo #2','Bounce, climb, and slide in one castle combo. Dry $250 or wet $275.','17L × 17W × 16H ft · 750 lb max · 1 adult supervisor','dry',25000,0,10),
('double-lane-palm-tree-combo','Double Lane Palm Tree Combo','Our biggest combo pairs a 17 × 17 castle with a double-lane palm tree slide. Dry $275 or wet $300.','17 × 17 ft castle section · full dimensions pending · 1 adult supervisor','dry',27500,0,11),
('toddler-combo','Toddler Combo','A small combo sized for little ones 6 and under. It can run wet for the same $175, with no pool attachment.','Dimensions pending · ages 6 and under · 1 adult supervisor','dry',17500,0,12),
('obstacle-combo','Obstacle Combo','A 2-in-1 with an obstacle run and a slide inside, our newest combo. Dry $225.','Dimensions pending · 750 lb max · 1 adult supervisor','dry',22500,0,13),
-- Slides
('fire-n-ice','20ft Fire ''N Ice with Pool','A two-story water slide where riders pick their height, then whip around the turn into the pool. Detach the pool for a dry slide. Dry $350 or wet $375.','34L × 17W × 20H ft · 600 lb max · riders 42–72 in. · up to 4 riders · 1 adult supervisor','dry',35000,0,14),
('big-kahuna','The Big Kahuna','A towering water slide with three ways to ride: slip and slide only $225, slide with pool $675, or slide, pool, and slip and slide together for 60 feet of splash at $850.','Slide alone 20L × 20W × 28H ft · with pool 31L × 20W × 28H ft · with slip and slide 60L × 20W × 28H ft · 1 adult supervisor','wet',22500,0,15),
('18ft-water-slide','18ft Water Slide','A firefighter-themed slide with hoses and pipes in neutral colors that suit any party. Wet $300 or dry $275.','25L × 10W × 18H ft · 300 lb max · riders 42–72 in. · 1 rider at a time · 1 adult supervisor','dry',27500,0,16),
('16ft-water-slide','16ft Water Slide','Our signature slide, dressed in the All About That Bounce logo colors. Wet $225.','20L × 15W × 16H ft · 300 lb max · riders 42–72 in. · up to 4 riders · 1 adult supervisor','wet',22500,0,17),
('rippling-tides','Rippling Tides','A double water slide in the spirit of our Fire ''N Ice. Dry $350 or wet $375.','25L × 13W × 20H ft · 1 adult supervisor','dry',35000,0,18),
('palm-tree','Palm Tree','An 18-foot palm tree water slide for a tropical day in the backyard. Wet only, $325.','18 ft tall · full dimensions pending · 1 adult supervisor','wet',32500,0,19),
('palm-tree-deluxe','Palm Tree Deluxe Waterslide','A taller 19-foot take on our palm tree slide. Dry $325 or wet $350.','19 ft · full dimensions pending · 1 adult supervisor','dry',32500,0,20),
('palmzilla','Palmzilla','A giant palm tree slide with three ways to ride: slip and slide only $225, slide with pool $675, or slide, pool, and slip and slide together at $850.','59L × 13W × 24H ft · 1 adult supervisor','wet',22500,0,21),
('18ft-double-lane-slide','18ft Double Lane Slide','A bright red, yellow, and blue slide where two riders race side by side. Dry only, $375.','30L × 14W × 18H ft · 1,000 lb max · riders 36 in. and taller · 1 rider per lane, 4 on the unit · 1 adult supervisor','dry',37500,0,22),
-- Obstacle courses
('7-element-obstacle-course','7 Element Obstacle Course','A 30-foot course where two players run, climb, jump, and crawl head to head. Course only $275, or $375 with the Rock Climb Slide added.','30L × 11W × 7H ft · 200 lb per rider · ages 5 and up · 2 riders at a time · 2 adult supervisors','dry',27500,0,23),
('rock-climb-slide','Rock Climb Slide','Two riders race up a rainbow rock wall, then down a 15-foot slide. $175 on its own, or $100 added to the 7 Element Obstacle Course.','26L × 13W × 15H ft · 200 lb per rider · ages 5 and up · 2 riders at a time · 2 adult supervisors','dry',17500,0,24),
('racer-obstacle-course','Racer Obstacle Course','A head-to-head course for two racers. Made for field days, camps, and team parties. Dry $275.','Dimensions pending · ages 5 and up · 2 riders at a time · 2 adult supervisors','dry',27500,0,25),
('level-up','Level Up','A 50-foot challenge with three ways to play: obstacle only $250, rock wall only $250, or obstacle with rock wall $450.','50L × 11W × 20H ft · 1 adult supervisor','dry',25000,0,26);
