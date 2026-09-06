# Product-use protocols

Last reviewed: 2026-09-06

## What the app now distinguishes

The catalog keeps three separate decisions:

1. **Effectiveness and fit** — ingredient evidence, the person's visible appearance goals, safety answers, and budget determine ranking.
2. **Manufacturer directions** — intended use, application amount/method, cadence, and layering order come from an official product page or official brand protocol when verified.
3. **Commercial attachment** — an affiliate or ordinary purchase URL attaches only after ranking. It cannot change evidence, eligibility, selection, order, or cadence.

This separation is intentional. A higher price does not make a product more effective. With **No price limit**, vAIne selects the best-supported safe match first and uses higher verified price only to break an otherwise exact evidence-and-fit tie.

## Source status

- 88 catalog products now have a structured protocol verified from an official product page or official brand routine, including travel sizes that inherit the matching full-size directions.
- Every catalog row resolves to structured intended-use, cadence, application, and order fields.
- Rows without an official protocol show **Catalog note — verify label** and do not invent exact manufacturer directions.
- Devices, supplements, bundles, travel sizes, and body products remain outside personalized face routines even when their official directions are displayed.

The authoritative runtime registry is `src/data/productUseProtocols.ts`. The catalog workbook remains the source of product identity, ingredients, review state, and price; protocol directions are a separately reviewed layer so regenerating the workbook import does not erase them.

## Important official brand systems

### Alitura

The official routine order is Pearl Cleanser, occasional Meteorite Scrub, occasional Derma Roller, occasional Clay Mask, Gold Serum, then Moisturizer in the morning or Night Cream in the evening. The official Four Step Facial is Cleanser → Scrub → Gold Serum → Night Cream.

vAIne does not reproduce the brand's more intensive scar protocol as an automatic schedule. It schedules the Clay Mask once weekly and the Meteorite Facial Scrub once weekly, allowing the scrub to increase to no more than twice weekly only if well tolerated. Neither is a daily cleanser. The app never combines a scrub, acid, retinoid, mask, or microneedling tool on the same evening. Microneedling remains outside the automated routine.

Sources:

- https://alitura.com/blogs/beauty-benefits/mapping-out-your-ideal-skincare-routine
- https://alitura.com/products/the-four-step-facial
- https://alitura.com/products/alitura-clay-mask
- https://alitura.com/products/the-meteorite-facial-scrub
- https://alitura.com/blogs/skinsupport/alituras-scar-healing-protocol

### Young Goose

The official core routine is cleanser → YOUTH RESET → EYEC.A.R.E. → YOUTH DAILY, morning and evening, with sunscreen as the final morning step. The brand's current topical longevity protocol is YOUTH RESET → BLUE PEPTIDE SPRAY → L.A.D.R. → YOUTH DAILY in the morning, and YOUTH RESET → BLUE PEPTIDE SPRAY → VAMPIRE EXOSOMES → YOUTH DAILY in the evening.

Bio-Retinol stays in the evening targeting step. The app separates it from exfoliation nights and phases it in gradually.

Sources:

- https://www.younggoose.com/products/youth-restoration-routine-1
- https://www.younggoose.com/pages/topical-longevity-protocol
- https://www.younggoose.com/pages/frequently-asked-questions
- https://www.younggoose.com/pages/sleep-protocol

### OneSkin

The official sequence is optional PREP → OS-01 EYE → OS-01 FACE → other treatments if desired → OS-01 FACE SPF as the final morning step. OS-01 FACE SPF is applied about one teaspoon over face and neck, 15 minutes before exposure, and reapplied every two hours outdoors.

Sources:

- https://www.oneskin.co/blogs/reference-lab/how-do-our-products-work-together
- https://www.oneskin.co/products/os-01-face-spf

### Vitali

The official full-care order is Gentle Exfoliating Cleanser → GHK-Cu serum → optional Bakuchiol at night → Skin Awakening Moisturizer → eye product → Hydration Boost Oil/Primer → morning SPF. A newer VITA-first protocol places VITA Zero Age Exosome Complex before GHK-Cu serum, moisturizer, facial oil, and SPF.

vAIne separates high-strength vitamin C and exfoliating acids from copper peptides and starts copper peptides three to four times weekly. The 10% lactic treatment is scheduled on its own evening.

Sources:

- https://www.vitaliskincare.com/blogs/inside-out/the-full-care-routine-designed-for-optimal-results
- https://www.vitaliskincare.com/blogs/inside-out/copper-peptides-hydrating-ingredients
- https://www.vitaliskincare.com/blogs/inside-out/vita-zero-age-exosomes-your-top-questions
- https://www.vitaliskincare.com/blogs/inside-out/reveal-your-radiance-the-gentle-power-of-lactic-acid-for-beautiful-skin

### Clinical and premium protocols

- Skinbetter Science: antioxidants after cleansing; AlphaRet at night; moisturizer follows; sunscreen is last in the morning.
- Revision Skincare: C+ Correcting Complex after cleansing and before moisturizer; Intellishade is the final morning step.
- iS Clinical: Cleansing Complex first; Super Serum Advance+ is applied as a three-to-four-drop serum step.
- Epicutis: Lipid Serum on clean skin, then Hyvia Crème, morning and evening.
- CALECIM Professional: Professional Serum after cleansing/toning, then progressively richer products; Multi-Action Cream follows the serum.
- (plated) Skin Science: INTENSE Serum first on clean, dry skin; wait five minutes before other products.
- DefenAge: its 8-in-1 BioSerum is unusual because the brand places it after Barrier Balance Cream; sunscreen follows in the morning and nothing follows it at night.
- Augustinus Bader: The Serum after cleansing, followed by The Rich Cream.
- Vintner's Daughter: cleanser → Active Treatment Essence → Active Botanical Serum, using the brand's press method.

## Safety adaptation rules

- Sunscreen remains the final morning skincare step. The current package Drug Facts control amount, reapplication, water resistance, and age restrictions.
- Retinoids start two or three evenings weekly and increase only as tolerated.
- Leave-on acids start every other evening or less often.
- A retinoid and an exfoliating acid are not scheduled on the same evening.
- At-home microneedling, electrical devices, light devices, supplements, and post-procedure regimens are never automatically prescribed by the routine builder.
- Recent-procedure answers pause targeted actives and defer to the treating professional's aftercare.
- Manufacturer marketing statements are presented as manufacturer directions, not as independent clinical conclusions.

## Affiliate disclosure and recommendation integrity

FTC guidance says a financial relationship with a brand is a material connection and the disclosure should be obvious, hard to miss, and placed with the endorsement. Every affiliate purchase button therefore keeps its disclosure adjacent to the link. Affiliate status, discount size, commission, and destination URL are structurally absent from the ranking input.

Reference: https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers
