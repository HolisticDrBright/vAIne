# Product evidence ranking

## Purpose

vAIne ranks eligible products by evidence for the appearance goals identified in a check-in. This is an ingredient-evidence ranking, not a claim that a finished product was clinically proven. Product marketing, affiliate status, commission, and price never increase an evidence score.

## Order of operations

1. Apply allergy, pregnancy or nursing, recent-procedure, sensitivity, fragrance, and duplicate-active exclusions.
2. Keep products that match an appearance goal from the check-in.
3. Score the ingredients for those matched goals using the evidence rules below.
4. Apply the selected price ceiling.
5. Rank by ingredient-evidence score and breadth of matched goals.
6. Break an otherwise equal tie by lower price for a capped budget or higher price when the user selected no price limit.

Rinse-off cleansers receive a contact-time adjustment. A missing concentration, delivery-system detail, or product-specific trial prevents the ingredient score from being presented as proof of finished-product efficacy.

## Evidence rules

| Ingredient or category | Main supported use | Relative evidence treatment | Source |
| --- | --- | --- | --- |
| Broad-spectrum UV filters | Prevention of visible sun-related aging | Strongest preventive score when the product has passed catalog and sunscreen-label review | https://pubmed.ncbi.nlm.nih.gov/23732711/ |
| Retinal and retinol | Fine lines, texture, uneven tone, photoaging | Strong; strength varies by retinoid, concentration, vehicle, and tolerance | https://pubmed.ncbi.nlm.nih.gov/39348007/ |
| Azelaic acid | Visible redness, blemishes, uneven tone | Strong for acne/rosacea/pigmentation outcomes; no eligible skin-aging RCTs in the review | https://pubmed.ncbi.nlm.nih.gov/37550898/ |
| Salicylic acid | Visible blemishes, oil, pore appearance, texture | Moderate; evidence quality and comparative certainty vary | https://pubmed.ncbi.nlm.nih.gov/33034949/ |
| Glycolic, lactic, and mandelic acids | Texture, dullness, uneven tone | Moderate; the directly cited randomized evidence is for glycolic acid, so other AHAs inherit a more cautious category score | https://pubmed.ncbi.nlm.nih.gov/8651713/ |
| Niacinamide | Uneven tone, visible redness, pores, oil, hydration, fine lines | Moderate | https://pubmed.ncbi.nlm.nih.gov/18492135/ |
| Ascorbic acid and vitamin C derivatives | Dullness, uneven tone, fine lines | Moderate and formulation-dependent | https://pubmed.ncbi.nlm.nih.gov/37683066/ |
| Bakuchiol | Fine lines, uneven tone, texture | Moderate but based on a relatively small comparative trial | https://pubmed.ncbi.nlm.nih.gov/29947134/ |
| Ceramides and barrier lipids | Hydration and barrier support | Moderate to strong for barrier support | https://pubmed.ncbi.nlm.nih.gov/33984185/ |
| Topical hyaluronic acid | Hydration and temporary line-plumping appearance | Moderate for hydration; formulation and molecular weight matter | https://pubmed.ncbi.nlm.nih.gov/36200921/ |
| Tranexamic acid | Uneven pigmentation appearance | Moderate and formulation-dependent | https://pubmed.ncbi.nlm.nih.gov/38843906/ |
| Peptides and copper peptides | Fine lines, hydration, texture | Limited to moderate; topical results and delivery are inconsistent | https://pubmed.ncbi.nlm.nih.gov/41924746/ |
| Topical growth factors | Fine lines and texture | Limited; studies are heterogeneous and comparative trials are weak | https://pubmed.ncbi.nlm.nih.gov/37222303/ |
| Exosome or extracellular-vesicle products | Rejuvenation claims | Limited; current certainty is low or very low | https://pubmed.ncbi.nlm.nih.gov/42487416/ |

## Current catalog limitations

The catalog contains 122 entries. The source audit found 111 research-only entries, seven blocked entries, four out-of-scope entries, and 57 entries with unknown skin-type compatibility. None of the imported rows currently contains a product-specific published-study citation. The ranking therefore scores every product from its recorded ingredients and category evidence while keeping the result explicitly separate from product-level clinical proof.

Before paid launch, each visible product needs current official product-page verification, complete INCI and active concentration where available, a skin-type and irritation review, sunscreen Drug Facts where applicable, and an independent reviewer decision. Product-specific trials should be linked separately and should supersede ingredient-only evidence only after study-quality and conflict-of-interest review.
