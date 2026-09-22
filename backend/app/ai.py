"""AI engine: phân tích CVE/asset bằng LLM endpoint OpenAI-compatible."""
import logging

import httpx

from . import config

log = logging.getLogger("ai")


def configured() -> bool:
    return bool(config.AI_API_BASE and config.AI_API_KEY and config.AI_MODEL)


async def chat(system: str, user_prompt: str, max_tokens: int = 1200) -> tuple[bool, str]:
    """Gọi /chat/completions. Trả về (ok, answer|error)."""
    if not configured():
        return False, "AI chưa cấu hình (AI_API_BASE / AI_API_KEY / AI_MODEL)"
    url = f"{config.AI_API_BASE}/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=config.AI_TIMEOUT) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {config.AI_API_KEY}"},
                json={
                    "model": config.AI_MODEL,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.3,
                },
            )
        if resp.status_code != 200:
            return False, f"AI API {resp.status_code}: {resp.text[:300]}"
        data = resp.json()
        answer = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
        return (bool(answer), answer or "AI trả về rỗng")
    except Exception as exc:
        detail = f"{type(exc).__name__}: {exc}" if str(exc) else type(exc).__name__
        log.warning("AI chat lỗi: %s", detail)
        return False, detail


SYSTEM_PROMPT = (
    "Bạn là chuyên gia an ninh mạng (pentester/Blue team) của tổ chức. "
    "Nhận cảnh báo CVE khớp với công nghệ trên asset nội bộ. "
    "Phân tích ngắn gọn bằng tiếng Việt: (1) Mức độ rủi ro thực tế cho asset, "
    "(2) Điều kiện khai thác, (3) Hướng xử lý ưu tiên. Trả về plain text, không markdown."
)


def build_cve_prompt(alert: dict) -> str:
    return (
        f"CVE: {alert.get('cveId')}\n"
        f"Mức độ: {alert.get('severity')} (CVSS {alert.get('cvssScore')})\n"
        f"Phần mềm: {alert.get('software')} — dải ảnh hưởng: {alert.get('affectedVersions')}\n"
        f"Asset: {alert.get('assetUrl')} (phát hiện: {alert.get('detectedVersion')})\n"
        f"Mô tả: {alert.get('cveTitle')}\n"
        f"Khuyến nghị hiện có: {alert.get('remediation')}\n\n"
        "Hãy đánh giá rủi ro cho asset này và đưa ra hướng xử lý cụ thể."
    )


EXTRACT_SYSTEM_PROMPT = (
    "Bạn là bộ parse tin nhắn CVE. Nhận tin nhắn Telegram mô tả một lỗ hổng, "
    "trả về DUY NHẤT một JSON (không markdown, không giải thích) dạng:\n"
    '{"cveId": "CVE-...", "software": "Tên phần mềm (VD: Sentry, Apache, Nginx)", '
    '"affectedVersions": "dải ảnh hưởng (VD: < 25.5.0, 2.4.0 - 2.4.55, *)", '
    '"severity": "CRITICAL|HIGH|MEDIUM|LOW", "cvssScore": số hoặc null, '
    '"summary": "tóm tắt 1-2 câu tiếng Việt"}\n'
    "Nếu không rõ trường nào, đoán hợp lý từ ngữ cảnh. affectedVersions không rõ thì dùng \"*\"."
)


async def extract_cve_from_text(text: str) -> dict:
    """Dùng LLM parse tin nhắn CVE tự do -> JSON cấu trúc. Lỗi -> fallback regex cơ bản."""
    import json as _json
    import re as _re

    ok, answer = await chat(EXTRACT_SYSTEM_PROMPT, text, max_tokens=600)
    data = {}
    if ok:
        try:
            m = _re.search(r"\{.*\}", answer, _re.DOTALL)
            if m:
                data = _json.loads(m.group(0))
        except Exception:
            data = {}

    m = _re.search(r"CVE-\d{4}-\d{4,}", text, _re.I)
    data.setdefault("cveId", m.group(0).upper() if m else "")
    sev = _re.search(r"CRITICAL|HIGH|MEDIUM|LOW", (text or "").upper())
    data.setdefault("severity", sev.group(0) if sev else "HIGH")
    if not data.get("summary"):
        data["summary"] = _re.sub(r"\s+", " ", text.strip())[:300]
    data.setdefault("affectedVersions", "*")
    data.setdefault("software", "")
    return data
