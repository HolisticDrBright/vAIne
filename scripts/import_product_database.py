#!/usr/bin/env python3
"""Convert the Longevity Skincare AI Product Database workbook into catalog rows.

Reads the ``Verified_Product_DB`` sheet (standard library only, no openpyxl)
and writes ``src/data/consumerCatalog.generated.json``: one ``CatalogEntry``
per product, in the shape ``src/domain/catalog/catalogEntry.ts`` validates at
runtime. The mapping is deliberately conservative — anything the sheet does
not state stays ``null`` / ``unknown`` so the app treats it cautiously.

Usage:
    python3 scripts/import_product_database.py \
        data/product-database/Longevity_Skincare_AI_Product_Database_v2.xlsx

Columns the sheet does not have yet, and what adding them would unlock:
    Price (USD)            -> approximatePriceCents, enables the budget filter
    Price verified (date)  -> priceVerifiedAtIso
    Fragrance-free (Y/N)   -> fragranceStatus, enables the fragrance preference
    Pregnancy reviewed     -> pregnancyNursingStatus
    Full INCI list         -> keyIngredients, enables allergen matching
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
SCHEMA_VERSION = 'catalog_entry_v1'
REVIEW_DATE = date.today().isoformat() + 'T00:00:00.000Z'

EXPECTED_HEADER = [
    'Priority', 'Brand', 'Product', 'Product Type', 'Category',
    'Known/Listed Actives or Positioning', 'Best Skin Findings From AI Analysis',
    'Best Skin Types', 'When to Use', 'Avoid / Caution Logic', 'Recommendation Logic',
    'Routine Slot', 'Affiliate Potential', 'Verification Level', 'Source URL', 'Notes',
]


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
    if re.search(r'pregnan', caution, re.I):
        return 'reviewed_avoid'
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


def key_ingredients(actives: str, product_type: str) -> list[str]:
    parts = [clean(p) for p in re.split(r'[;+,]|\band\b|\bwith\b', actives)]
    parts = [p for p in parts if p and len(p) <= 80]
    return parts[:8] or [clean(product_type) or 'not listed']


# --- Main -----------------------------------------------------------------

def convert(rows: list[list[str | None]], source_file: str) -> list[dict]:
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
        entries.append({
            'schemaVersion': SCHEMA_VERSION,
            'productId': product_id,
            'brand': brand,
            'productName': product,
            'category': row['Category'] or row['Product Type'] or 'uncategorized',
            'productKind': kind,
            'routineSlot': routine_slot(kind, row['Routine Slot'], row['Product Type']),
            'keyIngredients': key_ingredients(row['Known/Listed Actives or Positioning'], row['Product Type']),
            'skinConcernTags': observation_tags(row['Best Skin Findings From AI Analysis']),
            'skinTypeCompatibility': types,
            'sensitivityCaution': sensitivity_caution(row['Avoid / Caution Logic'], types),
            'pregnancyNursingStatus': pregnancy_status(row['Avoid / Caution Logic']),
            'allergyCautions': allergy_cautions(row['Avoid / Caution Logic'], row['Known/Listed Actives or Positioning']),
            'fragranceStatus': fragrance_status(row['Avoid / Caution Logic'], row['Known/Listed Actives or Positioning']),
            'crueltyFreeStatus': 'unknown',
            'veganStatus': 'unknown',
            'approximatePriceCents': None,
            'currencyCode': 'USD',
            'priceVerifiedAtIso': None,
            'affiliate': None,
            'nonAffiliateFallbackUrl': row['Source URL'] or None,
            'market': 'US',
            'availabilityStatus': 'available' if official else 'unknown',
            'source': 'reviewed_research',
            'lastReviewedAtIso': REVIEW_DATE,
            'evidenceReviewStatus': 'approved' if official else 'pending',
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
                'notes': row['Notes'] or None,
            },
        })
    return entries


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    source = Path(argv[1])
    output = Path(argv[2]) if len(argv) > 2 else Path('src/data/consumerCatalog.generated.json')
    entries = convert(read_sheet(source, SHEET_NAME), source.name)
    output.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    slots = {}
    for entry in entries:
        slots[entry['routineSlot']] = slots.get(entry['routineSlot'], 0) + 1
    print(f'Wrote {len(entries)} entries to {output}')
    print('Routine slots:', slots)
    print('Pending verification:', sum(1 for e in entries if e['evidenceReviewStatus'] != 'approved'))
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
