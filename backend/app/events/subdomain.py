"""DNS-safe public subdomains for published invitations (`varun-tanu.theinvitely.in`)."""

from __future__ import annotations

import random
import re
import unicodedata
from typing import Any

_GROOM_KEYS = ("groomShort", "groomName")
_BRIDE_KEYS = ("brideShort", "brideName")
_SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"


def _random_suffix(length: int = 6) -> str:
    return "".join(random.choices(_SUFFIX_ALPHABET, k=length))


def _find_name(data: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        for section in data.values():
            if isinstance(section, dict):
                value = section.get(key)
                if isinstance(value, str) and value.strip():
                    return value
    return ""


def _name_part(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    words = re.findall(r"[a-z0-9]+", ascii_name.lower())
    return words[0][:24] if words else ""

_SUBDOMAIN_MAX = 63
_SUBDOMAIN_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")

# Hostnames already used by the product or common infrastructure — never assign to a couple.
RESERVED_PUBLIC_SUBDOMAINS: frozenset[str] = frozenset(
    {
        "www",
        "api",
        "admin",
        "app",
        "assets",
        "backend",
        "blog",
        "cdn",
        "dashboard",
        "dev",
        "editor",
        "evoke",
        "ftp",
        "mail",
        "media",
        "preview",
        "staging",
        "static",
        "test",
        "vercel",
    }
)


def is_reserved_public_subdomain(label: str) -> bool:
    return label in RESERVED_PUBLIC_SUBDOMAINS


def is_valid_public_subdomain(label: str) -> bool:
    return bool(label) and len(label) <= _SUBDOMAIN_MAX and bool(_SUBDOMAIN_RE.fullmatch(label))


def normalize_public_subdomain_label(raw: str) -> str | None:
    """Lowercase slug fragment suitable as a single DNS label, or None if empty."""
    slug = re.sub(r"[^a-z0-9]+", "-", raw.strip().lower()).strip("-")
    if not slug:
        return None
    if len(slug) > _SUBDOMAIN_MAX:
        slug = slug[:_SUBDOMAIN_MAX].rstrip("-")
    if not slug or not _SUBDOMAIN_RE.fullmatch(slug):
        return None
    return slug


def published_subdomain_base(data: dict[str, Any]) -> str | None:
    """`varun-tanu` from couple names (`groomShort` / `brideShort`, etc.)."""
    groom = _name_part(_find_name(data, _GROOM_KEYS))
    bride = _name_part(_find_name(data, _BRIDE_KEYS))
    if not groom or not bride:
        return None
    return normalize_public_subdomain_label(f"{groom}-{bride}")


def fallback_public_subdomain_from_slug(slug: str) -> str:
    """Derive a label from an existing published slug when names are not ASCII."""
    stem = re.sub(r"-and-", "-", slug.lower())
    stem = re.sub(r"-[a-z0-9]{4}$", "", stem)
    label = normalize_public_subdomain_label(stem)
    if label and not is_reserved_public_subdomain(label):
        return label
    return f"invite-{_random_suffix(6)}"


def public_subdomain_candidates(base: str):
    """`varun-tanu`, then `varun-tanu-2`, `varun-tanu-3`, …"""
    first = normalize_public_subdomain_label(base)
    if first is None:
        return
    yield first
    for n in range(2, 200):
        suffix = f"-{n}"
        room = _SUBDOMAIN_MAX - len(suffix)
        stem = first[:room].rstrip("-")
        if not stem:
            continue
        yield f"{stem}{suffix}"