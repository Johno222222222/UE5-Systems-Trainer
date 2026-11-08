import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field

from core import db

router = APIRouter(prefix="/api/auth")
JWT_ALGORITHM = "HS256"
ACCESS_MIN = 15
REFRESH_DAYS = 7
GOOGLE_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
MAX_ATTEMPTS = 5
LOCKOUT_MIN = 15


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def _token(user_id: str, kind: str, delta: timedelta) -> str:
    payload = {"sub": user_id, "type": kind, "exp": datetime.now(timezone.utc) + delta}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def _cookie(resp: Response, key: str, value: str, max_age: int) -> None:
    resp.set_cookie(key=key, value=value, httponly=True, secure=True, samesite="none", max_age=max_age, path="/")


def set_jwt_cookies(resp: Response, user_id: str) -> None:
    _cookie(resp, "access_token", _token(user_id, "access", timedelta(minutes=ACCESS_MIN)), ACCESS_MIN * 60)
    _cookie(resp, "refresh_token", _token(user_id, "refresh", timedelta(days=REFRESH_DAYS)), REFRESH_DAYS * 86400)


def public_user(u: dict) -> dict:
    return {k: u.get(k) for k in ("user_id", "email", "name", "picture", "role", "email_verified")}


def _aware(dt):
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def _user_from_jwt(token: str):
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    if payload.get("type") != "access":
        return None
    return await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})


async def _user_from_session(token: str):
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess or _aware(sess["expires_at"]) < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})


async def optional_user(request: Request):
    access = request.cookies.get("access_token")
    if access and (u := await _user_from_jwt(access)):
        return u
    session = request.cookies.get("session_token")
    if session and (u := await _user_from_session(session)):
        return u
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        tok = header[7:]
        return await _user_from_jwt(tok) or await _user_from_session(tok)
    return None


async def current_user(request: Request) -> dict:
    user = await optional_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def admin_user(user: dict = Depends(current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class ResetLinkIn(BaseModel):
    email: EmailStr


class GoogleIn(BaseModel):
    session_id: str


# ---------- Routes ----------
@router.post("/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists. Sign in instead (or use Google if you signed up with it).")
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": body.name.strip() or email.split("@")[0],
        "picture": None, "role": "user", "email_verified": False,
        "password_hash": hash_password(body.password), "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    set_jwt_cookies(response, user["user_id"])
    return public_user(user)


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ident = f"{request.client.host if request.client else 'unknown'}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("count", 0) >= MAX_ATTEMPTS and _aware(attempt["last"]) > datetime.now(timezone.utc) - timedelta(minutes=LOCKOUT_MIN):
        raise HTTPException(status_code=429, detail=f"Too many failed attempts. Try again in {LOCKOUT_MIN} minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$inc": {"count": 1}, "$set": {"last": datetime.now(timezone.utc)}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": ident})
    set_jwt_cookies(response, user["user_id"])
    return public_user(user)


@router.post("/google")
async def google_session(body: GoogleIn, response: Response):
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(GOOGLE_SESSION_URL, headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        await db.users.update_one({"email": email}, {"$set": {"email_verified": True, "picture": data.get("picture") or user.get("picture")}})
        user_id = user["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": data.get("name") or email.split("@")[0],
            "picture": data.get("picture"), "role": "user", "email_verified": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    await db.user_sessions.insert_one({
        "session_token": data["session_token"], "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7), "created_at": datetime.now(timezone.utc),
    })
    _cookie(response, "session_token", data["session_token"], 7 * 86400)
    return public_user(await db.users.find_one({"user_id": user_id}, {"_id": 0}))


@router.get("/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    tok = request.cookies.get("refresh_token")
    try:
        payload = jwt.decode(tok or "", os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Session expired")
    if payload.get("type") != "refresh" or not await db.users.find_one({"user_id": payload["sub"]}):
        raise HTTPException(status_code=401, detail="Session expired")
    _cookie(response, "access_token", _token(payload["sub"], "access", timedelta(minutes=ACCESS_MIN)), ACCESS_MIN * 60)
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request, response: Response):
    if tok := request.cookies.get("session_token"):
        await db.user_sessions.delete_one({"session_token": tok})
    for key in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(key, path="/", secure=True, samesite="none")
    return {"ok": True}


@router.post("/admin/reset-link")
async def create_reset_link(body: ResetLinkIn, _: dict = Depends(admin_user)):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="No account with that email")
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token": token, "user_id": user["user_id"], "used": False,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
    })
    return {"token": token, "expires_in_minutes": 60}


@router.post("/reset-password")
async def reset_password(body: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": body.token})
    if not rec or rec.get("used") or _aware(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Ask the app owner for a new one.")
    await db.users.update_one({"user_id": rec["user_id"]}, {"$set": {"password_hash": hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"ok": True}


async def seed_admin() -> None:
    email = os.environ["ADMIN_EMAIL"].lower()
    if await db.users.find_one({"email": email}):
        return
    await db.users.insert_one({
        "user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": "Admin", "picture": None,
        "role": "admin", "email_verified": True, "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
