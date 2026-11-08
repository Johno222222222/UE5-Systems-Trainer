import asyncio
import os

import requests

from core import APP_NAME, EMERGENT_LLM_KEY

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
_storage_key = None


def init_storage(force: bool = False) -> str:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _request(method: str, path: str, **kwargs) -> requests.Response:
    for attempt in range(2):
        key = init_storage(force=attempt == 1)
        headers = {"X-Storage-Key": key, **kwargs.pop("headers", {})}
        resp = requests.request(method, f"{STORAGE_URL}/objects/{path}", headers=headers, **kwargs)
        if resp.status_code == 404 and attempt == 0 and method == "PUT":
            continue  # stale storage key; mint a fresh one once
        resp.raise_for_status()
        return resp
    return resp


def _put(path: str, data: bytes, content_type: str) -> dict:
    return _request("PUT", path, headers={"Content-Type": content_type}, data=data, timeout=120).json()


def _get(path: str) -> tuple[bytes, str]:
    resp = _request("GET", path, timeout=60)
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


async def put_object(rel_path: str, data: bytes, content_type: str) -> dict:
    return await asyncio.to_thread(_put, f"{APP_NAME}/{rel_path}", data, content_type)


async def get_object(path: str) -> tuple[bytes, str]:
    return await asyncio.to_thread(_get, path)
