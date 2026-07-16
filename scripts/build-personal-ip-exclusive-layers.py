#!/usr/bin/env python3
"""Build non-overlapping raster layers for the personal-IP animation route only.

The input spec defines semantic owners in priority order. Every non-white source
pixel can be claimed once. Later owners receive only pixels that are still
unclaimed, which prevents card/persona/Agent/path duplicates in SVG/HTML.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--audit")
    return parser.parse_args()


def selector_alpha(image: Image.Image, selector: str, white_distance: int, alpha_scale: int, accent_delta: int) -> Image.Image:
    pixels = []
    for red, green, blue, _ in image.convert("RGBA").getdata():
        distance = max(255 - red, 255 - green, 255 - blue)
        alpha = max(0, min(255, (distance - white_distance) * alpha_scale))
        if selector == "accent" and max(red, green, blue) - min(red, green, blue) < accent_delta:
            alpha = 0
        pixels.append(alpha)
    result = Image.new("L", image.size)
    result.putdata(pixels)
    return result


def region_mask(size: tuple[int, int], owner: dict) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    if owner.get("polygon"):
        draw.polygon([tuple(point) for point in owner["polygon"]], fill=255)
    else:
        x, y, width, height = owner["rect"]
        draw.rectangle((x, y, x + width - 1, y + height - 1), fill=255)
    return mask


def alpha_bbox(alpha: Image.Image) -> list[int] | None:
    bbox = alpha.getbbox()
    if not bbox:
        return None
    left, top, right, bottom = bbox
    return [left, top, right - left, bottom - top]


def main() -> None:
    args = parse_args()
    spec_path = Path(args.spec).resolve()
    output_root = Path(args.out).resolve()
    spec = json.loads(spec_path.read_text("utf-8"))
    master_path = Path(spec["master"])
    if not master_path.is_absolute():
        master_path = (spec_path.parent / master_path).resolve()
    master = Image.open(master_path).convert("RGBA")
    width, height = master.size
    if spec.get("canvas") and [width, height] != list(spec["canvas"]):
        raise SystemExit(f"Canvas mismatch: master={width}x{height}, spec={spec['canvas']}")

    output_root.mkdir(parents=True, exist_ok=True)
    white_distance = int(spec.get("thresholds", {}).get("whiteDistance", 12))
    alpha_scale = int(spec.get("thresholds", {}).get("alphaScale", 20))
    accent_delta = int(spec.get("thresholds", {}).get("accentDelta", 28))
    base_alpha = {
        "ink": selector_alpha(master, "ink", white_distance, alpha_scale, accent_delta),
        "accent": selector_alpha(master, "accent", white_distance, alpha_scale, accent_delta),
    }
    claimed = Image.new("L", master.size, 0)
    owner_masks: list[tuple[str, Image.Image]] = []
    outputs = []

    for priority, owner in enumerate(spec["owners"]):
        selector = owner.get("selector", "ink")
        if selector not in base_alpha:
            raise SystemExit(f"Unsupported selector for {owner['id']}: {selector}")
        region = region_mask(master.size, owner)
        candidate = ImageChops.multiply(base_alpha[selector], region)
        available = ImageChops.invert(claimed)
        alpha = ImageChops.multiply(candidate, available)
        binary_claim = alpha.point(lambda value: 255 if value > 0 else 0)
        claimed = ImageChops.lighter(claimed, binary_claim)

        x, y, crop_width, crop_height = owner["rect"]
        rgba = master.crop((x, y, x + crop_width, y + crop_height))
        crop_alpha = alpha.crop((x, y, x + crop_width, y + crop_height))
        rgba.putalpha(crop_alpha)
        output_path = output_root / f"{owner['id']}.png"
        rgba.save(output_path)
        local_bbox = alpha_bbox(crop_alpha)
        opaque_pixels = sum(1 for value in crop_alpha.getdata() if value > 16)
        outputs.append({
            "id": owner["id"],
            "role": owner["role"],
            "priority": priority,
            "zIndex": owner["zIndex"],
            "revealGroup": owner.get("revealGroup"),
            "components": owner.get("components", []),
            "selector": selector,
            "crop": owner["rect"],
            "asset": str(output_path),
            "sha256": sha256(output_path),
            "alphaBBoxLocal": local_bbox,
            "opaquePixelCount": opaque_pixels,
            "transparentPixelCount": crop_width * crop_height - opaque_pixels,
            "isOpaqueRectangle": opaque_pixels == crop_width * crop_height,
        })
        owner_masks.append((owner["id"], binary_claim))

    duplicate_pairs = []
    for index, (left_id, left_mask) in enumerate(owner_masks):
        for right_id, right_mask in owner_masks[index + 1:]:
            overlap = ImageChops.multiply(left_mask, right_mask)
            count = sum(1 for value in overlap.getdata() if value > 0)
            if count:
                duplicate_pairs.append({"owners": [left_id, right_id], "pixelCount": count})

    master_ink = base_alpha["ink"].point(lambda value: 255 if value > 0 else 0)
    unclaimed = ImageChops.multiply(master_ink, ImageChops.invert(claimed))
    unclaimed_count = sum(1 for value in unclaimed.getdata() if value > 0)
    audit = {
        "schemaVersion": 1,
        "route": "personal-ip-semantic-layers-svg-html-video",
        "scopeIsolation": "personal-ip-animation-only",
        "master": {
            "path": str(master_path),
            "sha256": sha256(master_path),
            "width": width,
            "height": height,
            "runtimeContentOwner": False,
        },
        "ownershipContract": {
            "exclusivePixels": True,
            "priorityOrder": [owner["id"] for owner in spec["owners"]],
            "duplicateOwnerPixelCount": sum(pair["pixelCount"] for pair in duplicate_pairs),
            "duplicateOwnerPairs": duplicate_pairs,
            "opaqueContentSlices": [item["id"] for item in outputs if item["isOpaqueRectangle"]],
            "unclaimedInkPixelCount": unclaimed_count,
            "unclaimedInkPolicy": spec.get("unclaimedInkPolicy", "audit-only"),
        },
        "layers": outputs,
        "pass": not duplicate_pairs and not any(item["isOpaqueRectangle"] for item in outputs),
    }
    manifest_path = output_root / "layer-ownership-manifest.json"
    manifest_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", "utf-8")
    if args.audit:
        audit_path = Path(args.audit).resolve()
        audit_path.parent.mkdir(parents=True, exist_ok=True)
        audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(json.dumps({"pass": audit["pass"], "manifest": str(manifest_path), "layers": len(outputs), "unclaimedInkPixelCount": unclaimed_count}, ensure_ascii=False, indent=2))
    if not audit["pass"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
