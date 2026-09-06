# Selective extraction record

Source inspected read-only:

- Repository: `HolisticDrBright/rork-ai-longevity-coach`
- Branch: `claude/visual-diagnostics-mvp`
- Commit: `79888fdeea07ddaa742884274ff14587ba5bec20`

## Patterns retained and rewritten

- Allow-listed observation tags with runtime filtering.
- Strict structured-output validation.
- Versioned prompts and schemas.
- Separation between image observations and deterministic product eligibility.
- Product and brand allow-list validation for generated copy.
- Regression tests for scope-of-practice language and invented products.

## Deliberately excluded

- Supabase clients, tables, storage, policies, migrations, and edge functions.
- Authentication and practitioner-role workflows.
- Lab, symptom, condition, medication, hormone, or protocol context.
- Cross-modality correlation and clinical alerts.
- Nutrient, organ, systemic, disease, and TCM pattern inference from skin photographs.
- Skin-age estimates, biological-health claims, procedures, supplements, and prescriptions.
- Product records, brand lists, affiliate URLs, commissions, and commercial ranking inputs.
- Private photographs, screenshots, report assets, and identifying details.

The vAIne modules are standalone rewrites. They are not connected to an AI provider or production backend, and they do not yet analyze photographs.

The per-product budget ceiling and fictional prototype prices were created specifically for vAIne. No price, product, affiliate, or effectiveness claim was imported from the research packages.
