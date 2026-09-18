"""
Subdomain discovery engines: subfinder (passive) + crt.sh (fallback).
"""
import asyncio
import logging
import re
import shutil

from . import config

log = logging.getLogger("discovery")

VALID_HOST_RE = re.compile(
    r"^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)


def subfinder_available() -> bool:
    return shutil.which("subfinder") is not None


async def _discover_subfinder(root: str) -> set:
    binary = shutil.which("subfinder")
    if not binary:
        raise RuntimeError("subfinder binary not found in PATH")
    proc = await asyncio.create_subprocess_exec(
        binary, "-d", root, "-silent", "-nc",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=config.SUBFINDER_TIMEOUT)
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError(f"subfinder timed out after {config.SUBFINDER_TIMEOUT}s")
    found = set()
    for line in out.decode("utf-8", errors="replace").splitlines():
        name = line.strip().lower().lstrip("*.")
        if name.endswith(root) and VALID_HOST_RE.match(name):
            found.add(name)
    return found


async def _discover_crtsh(root: str) -> set:
    import httpx as _httpx

    try:
        async with _httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                "https://crt.sh/",
                params={"q": f"%.{root}", "output": "json"},
                headers={"User-Agent": config.SCANNER_USER_AGENT},
            )
        entries = resp.json() if resp.status_code == 200 else []
    except Exception:
        entries = []
    found = set()
    for entry in entries:
        for name in str(entry.get("name_value", "")).splitlines():
            name = name.strip().lower().lstrip("*.")
            if name.endswith(root) and VALID_HOST_RE.match(name):
                found.add(name)
    return found


async def discover(root: str, engine: str = "auto") -> tuple[set, str | None, str | None]:
    """
    Trả về (subdomains, engine_used, note).
    engine: auto (subfinder, lỗi thì crt.sh) | subfinder | crtsh.
    """
    subdomains: set = set()
    engine_used = None
    note = None

    if engine in ("auto", "subfinder"):
        try:
            subdomains = await _discover_subfinder(root)
            engine_used = "subfinder"
        except Exception as exc:
            note = f"subfinder thất bại ({exc})"
            if engine == "subfinder":
                raise
            log.warning("subfinder %s lỗi: %s -> fallback crt.sh", root, exc)

    if not subdomains and engine in ("auto", "crtsh"):
        subdomains |= await _discover_crtsh(root)
        engine_used = "crtsh"
        if note:
            note += " → fallback crt.sh"
        elif engine == "auto":
            note = "dùng crt.sh (subfinder không trả kết quả)"

    return subdomains, engine_used, note
