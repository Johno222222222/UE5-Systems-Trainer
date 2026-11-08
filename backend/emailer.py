import ipaddress
import logging
import os
import re
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import Request

load_dotenv()
logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


def app_url(request: Request) -> str:
    # The ingress host this request came in on, i.e. this app's own domain
    return f"https://{request.headers.get('x-forwarded-host') or request.headers['host']}".split(",")[0].strip()


def template(heading: str, lines: list, button: str, link: str) -> str:
    body = "".join(f'<p style="margin:0 0 12px;color:#c9d1d9;font-size:14px;line-height:1.5">{escape(t)}</p>' for t in lines)
    return (
        '<table role="presentation" width="100%" style="background:#0b0e14"><tr><td style="padding:28px;font-family:Arial,sans-serif">'
        '<table role="presentation" width="100%" style="max-width:520px;background:#12161f;border:1px solid #232a36;border-radius:8px">'
        '<tr><td style="padding:24px">'
        f'<p style="margin:0 0 4px;color:#ff6b00;font-size:11px;letter-spacing:2px;text-transform:uppercase">{escape(EMAIL_FROM_NAME)}</p>'
        f'<h1 style="margin:0 0 16px;color:#ffffff;font-size:20px">{escape(heading)}</h1>{body}'
        f'<p style="margin:20px 0"><a href="{escape(link, quote=True)}" style="background:#ff6b00;color:#0b0e14;padding:10px 18px;'
        f'border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px">{escape(button)}</a></p>'
        f'<p style="margin:16px 0 0;color:#6e7681;font-size:11px">Sent by {escape(EMAIL_FROM_NAME)}. '
        'We never ask for your password by email. If you weren\'t expecting this, you can ignore it.</p>'
        '</td></tr></table></td></tr></table>'
    )


async def send_email(*, to: str, subject: str, html: str) -> bool:
    """Returns True when the provider accepted it; failures are logged, never raised."""
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return True
    except httpx.HTTPStatusError as e:
        try:
            code = e.response.json().get("code", "")
        except ValueError:
            code = ""
        logger.warning("Email not sent (%s %s)", e.response.status_code, code or e.response.text[:200])
    except Exception as e:
        logger.error("Email send error: %s", str(e)[:200])
    return False
