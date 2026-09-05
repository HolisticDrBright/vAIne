#!/usr/bin/env python3
"""Convert the Longevity Skincare AI Product Database workbook into catalog rows.

Reads the ``Verified_Product_DB`` sheet (standard library only, no openpyxl)
and writes ``src/data/consumerCatalog.generated.json``: one ``CatalogEntry``
per product, in the shape ``src/domain/catalog/catalogEntry.ts`` validates at
runtime. The mapping is deliberately conservative — anything the sheet does
not state stays ``null`` / ``unknown`` so the app treats it cautiously.

Usage:
    python3 scripts/import_product_database.py \
        data/product-database/Longevity_Skincare_AI_Product_Database_v2_fill_template.xlsx \
        [--affiliate-catalog /private/path/vAIne_Affiliate_Product_Catalog.xlsx] \
        [--no-research-preview] [--output src/data/consumerCatalog.generated.json]

Fill columns the workbook carries (blank = not known; never inferred):
    Price (USD) + Price Verified (date)   -> approximatePriceCents / priceVerifiedAtIso
    Fragrance-Free (Yes/No/Unknown)       -> fragranceStatus
    Full INCI                             -> keyIngredients (replaces listed actives)
    Pregnancy Flag: REVIEWED - ... values -> pregnancyNursingStatus (provisional values stay not_reviewed)
    Allergen Flags                        -> allergyCautions
    Catalog State / Blocker               -> catalogState / blocker (blocked and out_of_scope are held back)

Research preview (default on for the beta): rows still in `research_only`
state whose Verification Level is an official page are made visible and
labelled "research preview" in the app. Pass --no-research-preview to show
only rows whose Catalog State is `catalog_approved`, which is the launch rule.

The optional affiliate catalog workbook (kept outside the repository because
it carries commercial terms) contributes its Products sheet as research-only
rows: names, prices, key ingredient, plain-language notes. Affiliate codes,
rates, and commissions are never read.
"""
from __future__ import annotations

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}
SHEET_NAME = 'Verified_Product_DB'
AFFILIATE_SHEET_NAME = 'Products'
SCHEMA_VERSION = 'catalog_entry_v1'
REVIEW_DATE = date.today().isoformat() + 'T00:00:00.000Z'
# The affiliate catalog states its prices are approximate US retail, August 2026.
AFFILIATE_PRICE_DATE = '2026-08-06T00:00:00.000Z'

EXPECTED_HEADER = [
    'Priority', 'Brand', 'Product', 'Product Type', 'Category',
    'Known/Listed Actives or Positioning', 'Best Skin Findings From AI Analysis',
    'Best Skin Types', 'When to Use', 'Avoid / Caution Logic', 'Recommendation Logic',
    'Routine Slot', 'Affiliate Potential', 'Verification Level', 'Source URL', 'Notes',
]
# Optional fill columns added 2026-09-04; read by header name when present.
FILL_COLUMNS = {
    'price': 'Price (USD)',
    'price_source': 'Price Source URL',
    'price_verified': 'Price Verified (date)',
    'fragrance_free': 'Fragrance-Free',
    'fragrance_evidence': 'Fragrance Evidence',
    'inci': 'Full INCI',
    'inci_captured': 'INCI Captured (date)',
    'pregnancy_flag': 'Pregnancy Flag (PROVISIONAL)',
    'pregnancy_reviewed_by': 'Pregnancy Reviewed By',
    'pregnancy_review_date': 'Pregnancy Review Date',
    'allergen_flags': 'Allergen Flags',
    'catalog_state': 'Catalog State',
    'blocker': 'Blocker / Known Issue',
    'fill_priority': 'Fill Priority',
}
CATALOG_STATES = {'research_only', 'catalog_approved', 'blocked', 'out_of_scope'}


def read_sheet(path: Path, sheet_name: str) -> list[list[str | None]]:
    archive = zipfile.ZipFile(path)
    shared: list[str] = []
    if 'xl/sharedStrings.xml' in archive.namelist():
        root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
        for item in root.findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in item.iter('{%s}t' % NS['m'])))
    workbook = ET.fromstring(archive.read('xl/workbook.xml'))
    rels = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
    targets = {rel.get('Id'): rel.get('Target') for rel in rels}
    for sheet in workbook.find('m:sheets', NS):
        if sheet.get('name') != sheet_name:
            continue
        target = targets[sheet.get('{%s}id' % NS['r'])].lstrip('/')
        target = target if target.startswith('xl/') else 'xl/' + target
        root = ET.fromstring(archive.read(target))
        rows: list[dict[str, str | None]] = []
        for row in root.iter('{%s}row' % NS['m']):
            cells: dict[str, str | None] = {}
            for cell in row.findall('m:c', NS):
                column = re.match(r'[A-Z]+', cell.get('r')).group(0)
                kind = cell.get('t')
                value = cell.find('m:v', NS)
                if kind == 's' and value is not None:
                    cells[column] = shared[int(value.text)]
                elif kind == 'inlineStr':
                    cells[column] = ''.join(t.text or '' for t in cell.iter('{%s}t' % NS['m']))
                elif value is not None:
                    cells[column] = value.text
                else:
                    cells[column] = None
            rows.append(cells)
        columns = sorted({c for r in rows for c in r}, key=lambda c: sum((ord(ch) - 64) * 26 ** i for i, ch in enumerate(reversed(c))))
        return [[r.get(c) for c in columns] for r in rows]
    raise SystemExit(f'Sheet {sheet_name!r} not found in {path}')


def clean(value: str | None) -> str:
    return re.sub(r'\s+', ' ', (value or '')).strip()


def slugify(*parts: str) -> str:
    text = ' '.join(parts).lower()
    text = text.replace('%', ' pct ').replace('&', ' and ').replace('+', ' plus ')
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', text)).strip('-')


# --- Routine slot ---------------------------------------------------------

ROUTINE_SLOT_BY_SHEET_SLOT = {
    'cleanser': 'cleanse',
    'sunscreen': 'protect',
    'weekly mask': 'weekly',
    'exfoliation': 'weekly',
    'weekly exfoliation': 'weekly',
    'moisturizer': 'hydrate',
    'night moisturizer': 'hydrate',
    'essence': 'hydrate',
    'hydrating mist': 'hydrate',
    'toner': 'hydrate',
    'oil/primer': 'hydrate',
    'night oil': 'hydrate',
    'treatment serum': 'support',
    'advanced serum': 'support',
    'serum': 'support',
    'antioxidant serum': 'support',
    'night treatment': 'support',
    'barrier serum': 'support',
    'eye cream': 'support',
    'eye/lash treatment': 'support',
    'neck/chest cream': 'support',
    'lip care': 'support',
}

# For rows whose sheet slot is "Varies", fall back to the product type.
ROUTINE_SLOT_BY_TYPE = [
    (re.compile(r'cleanser', re.I), 'cleanse'),
    (re.compile(r'body spf', re.I), None),
    (re.compile(r'spf|sunscreen', re.I), 'protect'),
    (re.compile(r'eye|retinoid|retinol', re.I), 'support'),
    (re.compile(r'mask|exfoliant|exfoliating|scrub|peel', re.I), 'weekly'),
    (re.compile(r'body|hair|device|tool|(?<!topical )(?<!topical/)supplement|bundle|system|travel', re.I), None),
    (re.compile(r'moisturizer|cream|essence|mist|toner|oil', re.I), 'hydrate'),
    (re.compile(r'serum|treatment|eye|neck|lip|retinoid|vitamin c|antioxidant', re.I), 'support'),
]

PRODUCT_KIND_RULES = [
    (re.compile(r'travel', re.I), 'travel_size'),
    (re.compile(r'bundle|system|kit|set|duo|trio', re.I), 'bundle'),
    (re.compile(r'(?<!topical )(?<!topical/)supplement|nutraceutical', re.I), 'supplement'),
    (re.compile(r'device|tool|roller|microcurrent', re.I), 'device'),
    (re.compile(r'body|hair', re.I), 'body'),
]


def product_kind(product_type: str, sheet_slot: str, category: str) -> str:
    haystack = ' '.join([product_type, sheet_slot, category])
    for pattern, kind in PRODUCT_KIND_RULES:
        if pattern.search(haystack):
            return kind
    return 'single'


def routine_slot(kind: str, sheet_slot: str, product_type: str) -> str | None:
    if kind != 'single':
        return None
    mapped = ROUTINE_SLOT_BY_SHEET_SLOT.get(sheet_slot.lower())
    if mapped:
        return mapped
    for pattern, slot in ROUTINE_SLOT_BY_TYPE:
        if pattern.search(product_type):
            return slot
    return None


# --- Observation tags -----------------------------------------------------

TAG_RULES = [
    ('appearance.hydration_look_low', re.compile(r'dehydrat|dryness|\bdry\b|hydration|crepey|crepiness|moisture|barrier', re.I)),
    ('appearance.visible_redness', re.compile(r'redness|reactiv|inflamm|irritat|rosacea|calming|sensitive', re.I)),
    ('appearance.tone_uneven', re.compile(r'pigment|uneven tone|tone support|\btone\b|discolor|brighten|dark spot', re.I)),
    ('appearance.texture_irregular', re.compile(r'texture|rough|smooth|resurfac|renewal', re.I)),
    ('appearance.pore_visibility_high', re.compile(r'\bpore|congestion|clogged', re.I)),
    ('appearance.fine_lines_visible', re.compile(r'fine line|wrinkle|\blines\b|aging|ageing|collagen|firmness|firming|elasticity|laxity|lifting', re.I)),
    ('appearance.oiliness_visible', re.compile(r'oily|oiliness|t-zone|\bshine\b|sebum', re.I)),
    ('appearance.dullness_visible', re.compile(r'\bdull|radiance|\bglow|fatigue|tired|brightness', re.I)),
    ('appearance.dark_circles_visible', re.compile(r'dark circle|under-eye (?:fine lines/)?dark|darkness', re.I)),
    ('appearance.blemishes_visible', re.compile(r'acne|blemish|breakout', re.I)),
    ('appearance.lip_dryness_visible', re.compile(r'\blip', re.I)),
    ('appearance.sun_exposure_signs_visible', re.compile(r'\bsun\b|\buv\b|photoaging|\bspf\b|pigmentation risk', re.I)),
]


def observation_tags(findings: str) -> list[str]:
    return [tag for tag, pattern in TAG_RULES if pattern.search(findings)]


# --- Skin types, cautions, ingredients ------------------------------------

SKIN_TYPE_RULES = [
    ('dry', re.compile(r'\bdry\b', re.I)),
    ('oily', re.compile(r'\boily\b', re.I)),
    ('combination', re.compile(r'combination|\bcombo\b', re.I)),
    ('sensitive', re.compile(r'sensitive|reactive', re.I)),
    ('balanced', re.compile(r'\bnormal\b', re.I)),
]


def skin_types(text: str) -> list[str]:
    if re.search(r'\ball\b', text, re.I):
        return ['dry', 'oily', 'combination', 'sensitive', 'balanced']
    found = [name for name, pattern in SKIN_TYPE_RULES if pattern.search(text)]
    return found or ['unknown']


SENSITIVITY_CAUTION = re.compile(
    r'caution (?:with |for |if )?(?:sensitive|reactive)|sensitive/rosacea|highly sensitive|highly reactive|rosacea|'
    r'barrier (?:is )?damage|inflamed|fragrance|essential oil|patch test (?:for|if) reactive|not for .*reactive|'
    r'if reactive|use cautiously if reactive',
    re.I,
)


def sensitivity_caution(caution: str, types: list[str]) -> bool | None:
    if SENSITIVITY_CAUTION.search(caution):
        return True
    if 'sensitive' in types:
        return False
    return None


def fragrance_status(caution: str, actives: str) -> str:
    if re.search(r'fragrance|essential oil|ylang|sandalwood|bergamot', caution + ' ' + actives, re.I):
        return 'contains_fragrance'
    return 'unknown'


def pregnancy_status(caution: str) -> str:
    # Caution text is not a signed review. Unreviewed products are already
    # excluded for anyone pregnant, trying, or nursing, so no inference is needed.
    return 'not_reviewed'


ALLERGY_RULES = [
    ('bee products (propolis)', re.compile(r'\bbee\b|propolis', re.I)),
    ('colostrum (dairy)', re.compile(r'colostrum', re.I)),
    ('fragrance', re.compile(r'fragrance', re.I)),
    ('essential oils', re.compile(r'essential oil|ylang|sandalwood|bergamot', re.I)),
    ('vitamin C (ascorbic acid)', re.compile(r'ascorbic|vitamin c', re.I)),
]


def allergy_cautions(caution: str, actives: str) -> list[str]:
    haystack = caution + ' ' + actives
    return [name for name, pattern in ALLERGY_RULES if pattern.search(haystack)]


def parse_price_cents(text: str) -> int | None:
    match = re.search(r'\d+(?:\.\d+)?', text.replace(',', ''))
    if not match:
        return None
    cents = round(float(match.group(0)) * 100)
    return cents if cents > 0 else None


def parse_iso_date(text: str) -> str | None:
    text = text.strip()
    if not text:
        return None
    # Excel serial dates arrive as plain numbers from the raw XML.
    if re.fullmatch(r'\d{5}(?:\.\d+)?', text):
        from datetime import datetime, timedelta
        return (datetime(1899, 12, 30) + timedelta(days=float(text))).strftime('%Y-%m-%dT00:00:00.000Z')
    match = re.match(r'(\d{4})-(\d{2})-(\d{2})', text)
    if match:
        return f'{match.group(1)}-{match.group(2)}-{match.group(3)}T00:00:00.000Z'
    match = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', text)
    if match:
        return f'{match.group(3)}-{int(match.group(1)):02d}-{int(match.group(2)):02d}T00:00:00.000Z'
    return None


def fragrance_from_fill(value: str) -> str | None:
    lowered = value.strip().lower()
    if lowered in {'yes', 'y', 'true', 'fragrance-free', 'fragrance free'}:
        return 'fragrance_free'
    if lowered in {'no', 'n', 'false', 'contains fragrance', 'fragranced'}:
        return 'contains_fragrance'
    return None


def pregnancy_from_fill(value: str) -> str | None:
    """Only signed REVIEWED values are trusted; provisional classes stay not_reviewed."""
    lowered = value.strip().lower()
    if not lowered.startswith('reviewed'):
        return None
    if 'avoid' in lowered or 'practitioner' in lowered or 'caution' in lowered:
        return 'reviewed_avoid'
    if 'acceptable' in lowered or 'ok' in lowered or 'safe' in lowered:
        return 'reviewed_acceptable'
    return None


def split_list(text: str) -> list[str]:
    return [clean(p) for p in re.split(r'[;,\n]', text) if clean(p)]


def split_inci(text: str) -> list[str]:
    """Full INCI list: comma separated, with optional ACTIVE:/INACTIVE: labels."""
    items = []
    if re.match(r'^\s*(?:NOT[_ ]FOUND|N/?A|NONE|SITE UNREACHABLE|UNKNOWN)\b', text, re.I):
        return []
    for part in re.split(r'[,;\n]', text):
        part = re.sub(r'^\s*(?:ACTIVE|INACTIVE)\s*(?:INGREDIENTS?)?\s*:\s*', '', clean(part), flags=re.I)
        part = re.sub(r'\.\s*(?:ACTIVE|INACTIVE)\s*(?:INGREDIENTS?)?\s*:\s*.*$', '', part, flags=re.I).strip(' .')
        if part and len(part) <= 120:
            items.append(part)
    return items


def split_allergen_flags(text: str) -> list[str]:
    """Allergen Flags cells read like
    'Fragrant botanicals/EO: Lavender Oil; Rose Geranium Flower Oil | EU allergen: Bisabolol present (...)'.
    Labels are dropped, parentheticals removed, and an 'essential oils' marker is
    added whenever an essential oil or fragrant botanical is named."""
    names = []
    for group in text.split('|'):
        group = clean(group)
        if not group:
            continue
        label, _, rest = group.partition(':')
        if _ and ',' not in label and len(label) <= 40:
            group = rest
        group = re.sub(r'\([^)]*\)', '', group)
        for name in re.split(r'[;,+]', group):
            name = clean(name)
            name = re.sub(r'^(?:\d+ of \d+ ingredients aromatic|NINE essential oils|aromatic botanical extracts)\s*:?\s*', '', name, flags=re.I)
            name = re.sub(r'\s+(?:present|declared)$', '', name, flags=re.I)
            if name and len(name) <= 80 and not name.lower().startswith('but no '):
                names.append(name)
    if re.search(r'essential oil|\bEOs?\b|fragrant botanical|\boil\b', text, re.I) and 'essential oils' not in [n.lower() for n in names]:
        names.append('essential oils')
    seen = set(); unique = []
    for name in names:
        if name.lower() not in seen:
            seen.add(name.lower()); unique.append(name)
    return unique


BLOCKING_PREFIXES = ('BLOCKER', 'DOES NOT EXIST', 'ROW MUST BE SPLIT', 'OUT OF SCOPE', 'NOT FOUND', 'NEEDS PRODUCT-PAGE VERIFICATION')


def is_blocking_note(text: str) -> bool:
    return text.strip().upper().startswith(BLOCKING_PREFIXES)


def key_ingredients(actives: str, product_type: str) -> list[str]:
    parts = [clean(p) for p in re.split(r'[;+,]|\band\b|\bwith\b', actives)]
    parts = [p for p in parts if p and len(p) <= 80]
    return parts[:8] or [clean(product_type) or 'not listed']


# --- Main -----------------------------------------------------------------

def convert(rows: list[list[str | None]], source_file: str, research_preview: bool = True) -> list[dict]:
    header = [clean(c) for c in rows[0]]
    if header[: len(EXPECTED_HEADER)] != EXPECTED_HEADER:
        raise SystemExit(f'Unexpected header: {header}')
    entries = []
    seen_ids: set[str] = set()
    for index, raw in enumerate(rows[1:], start=2):
        row = {name: clean(raw[i]) if i < len(raw) else '' for i, name in enumerate(header)}
        brand, product = row['Brand'], row['Product']
        if not brand or not product:
            continue
        kind = product_kind(row['Product Type'], row['Routine Slot'], row['Category'])
        official = row['Verification Level'].lower().startswith('official')
        product_id = slugify(brand, product)
        if product_id in seen_ids:
            product_id = f'{product_id}-row{index}'
        seen_ids.add(product_id)
        types = skin_types(row['Best Skin Types'])
        fill = {key: row.get(column, '') for key, column in FILL_COLUMNS.items()}
        catalog_state = fill['catalog_state'].strip().lower() or 'research_only'
        if catalog_state not in CATALOG_STATES:
            catalog_state = 'research_only'
        price_cents = parse_price_cents(fill['price'])
        price_verified = parse_iso_date(fill['price_verified']) if price_cents else None
        if price_cents and not price_verified:
            # A price without a verification date is not trusted; keep it unverified.
            price_cents = None
        inci = split_inci(fill['inci'])
        blocker_text = fill['blocker'].strip()
        # The Blocker column carries both real blockers and capture notes
        # ("50ml $87 / 100ml $149"). Only recognised blocking prefixes, or a
        # blocked/out-of-scope Catalog State, hold a row back; the rest is
        # shown as a note.
        blocking = catalog_state in {'blocked', 'out_of_scope'} or is_blocking_note(blocker_text)
        not_found = blocker_text.upper().startswith('NOT FOUND') or blocker_text.upper().startswith('DOES NOT EXIST')
        capture_note = None if blocking else (blocker_text or None)
        if catalog_state == 'catalog_approved':
            evidence = 'approved'
        elif catalog_state in {'blocked', 'out_of_scope'}:
            evidence = 'rejected'
        elif research_preview and official and not blocking:
            evidence = 'approved'
        else:
            evidence = 'pending'
        entries.append({
            'schemaVersion': SCHEMA_VERSION,
            'productId': product_id,
            'brand': brand,
            'productName': product,
            'category': row['Category'] or row['Product Type'] or 'uncategorized',
            'productKind': kind,
            'routineSlot': routine_slot(kind, row['Routine Slot'], row['Product Type']),
            'keyIngredients': inci or key_ingredients(row['Known/Listed Actives or Positioning'], row['Product Type']),
            'skinConcernTags': observation_tags(row['Best Skin Findings From AI Analysis']),
            'skinTypeCompatibility': types,
            'sensitivityCaution': sensitivity_caution(row['Avoid / Caution Logic'], types),
            'pregnancyNursingStatus': pregnancy_from_fill(fill['pregnancy_flag']) or pregnancy_status(row['Avoid / Caution Logic']),
            'allergyCautions': split_allergen_flags(fill['allergen_flags']) or allergy_cautions(row['Avoid / Caution Logic'], row['Known/Listed Actives or Positioning']),
            'fragranceStatus': fragrance_from_fill(fill['fragrance_free']) or fragrance_status(row['Avoid / Caution Logic'], row['Known/Listed Actives or Positioning']),
            'crueltyFreeStatus': 'unknown',
            'veganStatus': 'unknown',
            'approximatePriceCents': price_cents,
            'currencyCode': 'USD',
            'priceVerifiedAtIso': price_verified,
            'affiliate': None,
            'nonAffiliateFallbackUrl': row['Source URL'] or None,
            'market': 'US',
            'availabilityStatus': 'unknown' if not_found else ('available' if official else 'unknown'),
            'source': 'reviewed_research',
            'lastReviewedAtIso': REVIEW_DATE,
            'evidenceReviewStatus': evidence,
            'catalogState': catalog_state,
            'blocker': blocker_text if blocking else None,
            'active': True,
            'sourceNotes': {
                'sourceFile': source_file,
                'sourceRow': index,
                'priority': int(row['Priority'] or 0) or None,
                'verificationLevel': row['Verification Level'] or None,
                'findings': row['Best Skin Findings From AI Analysis'] or None,
                'bestFor': row['Best Skin Types'] or None,
                'whenToUse': row['When to Use'] or None,
                'caution': row['Avoid / Caution Logic'] or None,
                'recommendationLogic': row['Recommendation Logic'] or None,
                'notes': ' '.join(part for part in [row['Notes'], capture_note] if part) or None,
                'pregnancyProvisional': fill['pregnancy_flag'].strip() or None,
                'fillPriority': fill['fill_priority'].strip() or None,
            },
        })
    return entries


# --- Affiliate research catalog (optional second source) ------------------

AFFILIATE_HEADER = ['Brand', 'Product', 'Tier', 'Price ($)', 'Key ingredient', 'What it does', 'Best for']

BEST_FOR_TAGS = [
    ('appearance.pore_visibility_high', re.compile(r'pore', re.I)),
    ('appearance.oiliness_visible', re.compile(r'\boil\b', re.I)),
    ('appearance.texture_irregular', re.compile(r'texture', re.I)),
    ('appearance.tone_uneven', re.compile(r'tone|dark spot|redness', re.I)),
    ('appearance.visible_redness', re.compile(r'redness|sensitive|barrier', re.I)),
    ('appearance.dullness_visible', re.compile(r'radiance', re.I)),
    ('appearance.hydration_look_low', re.compile(r'hydration|barrier', re.I)),
    ('appearance.fine_lines_visible', re.compile(r'aging|eye area', re.I)),
    ('appearance.sun_exposure_signs_visible', re.compile(r'\bspf\b', re.I)),
]

AFFILIATE_SLOT_RULES = [
    (re.compile(r'cleanser', re.I), 'cleanse', 'single'),
    (re.compile(r'body', re.I), None, 'body'),
    (re.compile(r'spf|sunscreen', re.I), 'protect', 'single'),
    (re.compile(r'mask|exfoliant|exfoliating|peel|toning solution', re.I), 'weekly', 'single'),
    (re.compile(r'cream|moisturi|oil\b|essence|lotion', re.I), 'hydrate', 'single'),
    (re.compile(r'serum|retin|treatment|booster|emulsion|complex', re.I), 'support', 'single'),
]


def normalized_name(brand: str, product: str) -> str:
    text = f'{brand} {product}'.lower()
    text = re.sub(r'\bthe\b', ' ', text)
    return re.sub(r'[^a-z0-9]+', '', text)


def convert_affiliate_catalog(rows: list[list[str | None]], source_file: str, existing: set[str]) -> list[dict]:
    header = [clean(c) for c in rows[0]]
    if header[: len(AFFILIATE_HEADER)] != AFFILIATE_HEADER:
        raise SystemExit(f'Unexpected affiliate catalog header: {header}')
    entries = []
    for index, raw in enumerate(rows[1:], start=2):
        row = {name: clean(raw[i]) if i < len(raw) else '' for i, name in enumerate(header)}
        brand, product = row['Brand'], row['Product']
        if not brand or not product or brand.upper() == 'NOTES':
            continue
        if normalized_name(brand, product) in existing:
            continue  # the governed database already carries this product
        slot, kind = None, 'single'
        for pattern, matched_slot, matched_kind in AFFILIATE_SLOT_RULES:
            if pattern.search(product):
                slot, kind = matched_slot, matched_kind
                break
        price_cents = parse_price_cents(row['Price ($)'])
        entries.append({
            'schemaVersion': SCHEMA_VERSION,
            'productId': slugify(brand, product),
            'brand': brand,
            'productName': product,
            'category': f"{row['Tier']} tier" if row['Tier'] else 'uncategorized',
            'productKind': kind,
            'routineSlot': slot,
            'keyIngredients': split_list(row['Key ingredient'].replace('+', ',')) or ['not listed'],
            'skinConcernTags': [tag for tag, pattern in BEST_FOR_TAGS if pattern.search(row['Best for'])],
            'skinTypeCompatibility': ['sensitive'] if re.search(r'sensitive', row['Best for'], re.I) else ['unknown'],
            'sensitivityCaution': None,
            'pregnancyNursingStatus': 'not_reviewed',
            'allergyCautions': [],
            'fragranceStatus': 'unknown',
            'crueltyFreeStatus': 'unknown',
            'veganStatus': 'unknown',
            'approximatePriceCents': price_cents,
            'currencyCode': 'USD',
            'priceVerifiedAtIso': AFFILIATE_PRICE_DATE if price_cents else None,
            'affiliate': None,
            'nonAffiliateFallbackUrl': None,
            'market': 'US',
            'availabilityStatus': 'unknown',
            'source': 'reviewed_research',
            'lastReviewedAtIso': REVIEW_DATE,
            'evidenceReviewStatus': 'pending',
            'catalogState': 'research_only',
            'blocker': 'Research only: needs identity, safety, and catalog review before it can be offered.',
            'active': True,
            'sourceNotes': {
                'sourceFile': source_file,
                'sourceRow': index,
                'priority': None,
                'verificationLevel': 'Affiliate research catalog (approximate US retail price, August 2026)',
                'findings': row['Best for'] or None,
                'bestFor': None,
                'whenToUse': None,
                'caution': None,
                'recommendationLogic': row['What it does'] or None,
                'notes': None,
                'pregnancyProvisional': None,
                'fillPriority': None,
            },
        })
    return entries


def main(argv: list[str]) -> int:
    import argparse
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('workbook', help='governed product database workbook (.xlsx)')
    parser.add_argument('--affiliate-catalog', help='optional affiliate research catalog workbook (kept outside the repo)')
    parser.add_argument('--no-research-preview', action='store_true', help='show only catalog_approved rows (launch rule)')
    parser.add_argument('--output', default='src/data/consumerCatalog.generated.json')
    args = parser.parse_args(argv[1:])

    source = Path(args.workbook)
    entries = convert(read_sheet(source, SHEET_NAME), source.name, research_preview=not args.no_research_preview)
    if args.affiliate_catalog:
        affiliate = Path(args.affiliate_catalog)
        existing = {normalized_name(e['brand'], e['productName']) for e in entries}
        entries += convert_affiliate_catalog(read_sheet(affiliate, AFFILIATE_SHEET_NAME), affiliate.name, existing)
    output = Path(args.output)
    output.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    def count(predicate):
        return sum(1 for e in entries if predicate(e))
    print(f'Wrote {len(entries)} entries to {output}')
    print('Visible (evidence approved):', count(lambda e: e['evidenceReviewStatus'] == 'approved'))
    print('Held back:', count(lambda e: e['evidenceReviewStatus'] != 'approved'),
          '| blocked:', count(lambda e: e['catalogState'] == 'blocked'),
          '| out of scope:', count(lambda e: e['catalogState'] == 'out_of_scope'))
    print('Priced:', count(lambda e: e['approximatePriceCents'] is not None))
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
