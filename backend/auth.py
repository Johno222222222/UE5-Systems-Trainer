import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field, field_validator

from core import db
import emailer

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


def _token(user_id: str, kind: str, delta: timedelta, tv: int = 0) -> str:
    payload = {"sub": user_id, "type": kind, "tv": tv, "exp": datetime.now(timezone.utc) + delta}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def _cookie(resp: Response, key: str, value: str, max_age: int) -> None:
    resp.set_cookie(key=key, value=value, httponly=True, secure=True, samesite="none", max_age=max_age, path="/")


def set_jwt_cookies(resp: Response, user: dict) -> None:
    tv = user.get("token_version", 0)
    _cookie(resp, "access_token", _token(user["user_id"], "access", timedelta(minutes=ACCESS_MIN), tv), ACCESS_MIN * 60)
    _cookie(resp, "refresh_token", _token(user["user_id"], "refresh", timedelta(days=REFRESH_DAYS), tv), REFRESH_DAYS * 86400)


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
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user or user.get("token_version", 0) != payload.get("tv", 0):
        return None
    return user


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
def _bcrypt_len(v: str) -> str:
    if len(v.encode()) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return v


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    _len = field_validator("password")(_bcrypt_len)
    name: str = Field(default="", max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=72)
    _len = field_validator("password")(_bcrypt_len)


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
    set_jwt_cookies(response, user)
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
    set_jwt_cookies(response, user)
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
        update = {"$set": {"email_verified": True, "picture": data.get("picture") or user.get("picture")}}
        if not user.get("email_verified"):
            # Unverified password account: it may have been pre-registered by someone else
            update["$unset"] = {"password_hash": ""}
            update["$inc"] = {"token_version": 1}
            await db.projects.update_many({"members.user_id": user["user_id"]}, {"$set": {"members.$[m].user_id": None}}, array_filters=[{"m.user_id": user["user_id"]}])
        await db.users.update_one({"email": email}, update)
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
    user = await db.users.find_one({"user_id": payload["sub"]}) if payload.get("type") == "refresh" else None
    if not user or user.get("token_version", 0) != payload.get("tv", 0):
        raise HTTPException(status_code=401, detail="Session expired")
    _cookie(response, "access_token", _token(user["user_id"], "access", timedelta(minutes=ACCESS_MIN), user.get("token_version", 0)), ACCESS_MIN * 60)
    return {"ok": True}


@router.post("/logout")
async def logout(request: Request, response: Response):
    if tok := request.cookies.get("session_token"):
        await db.user_sessions.delete_one({"session_token": tok})
    user_id = (await optional_user(request) or {}).get("user_id")
    if not user_id and (rt := request.cookies.get("refresh_token")):
        try:
            payload = jwt.decode(rt, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
            user_id = payload["sub"] if payload.get("type") == "refresh" else None
        except jwt.InvalidTokenError:
            user_id = None
    if user_id:
        await db.users.update_one({"user_id": user_id}, {"$inc": {"token_version": 1}})
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


class ForgotIn(BaseModel):
    email: EmailStr


@router.post("/forgot-password")
async def forgot_password(body: ForgotIn, request: Request):
    # Same reply whether or not the account exists, so emails can't be probed
    reply = {"ok": True, "message": "If an account with a password exists for that email, a reset link is on its way."}
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password_hash"):
        return reply
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    if await db.password_reset_tokens.count_documents({"user_id": user["user_id"], "created_at": {"$gte": since}}) >= 3:
        return reply
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token": token, "user_id": user["user_id"], "used": False, "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
    })
    html = emailer.template(
        "Reset your password",
        [f"Hi {user.get('name') or 'there'}, someone asked to reset the password for {user['email']}.",
         "The link works once and expires in 1 hour. If this wasn't you, ignore this email and nothing changes."],
        "Choose a new password", f"{emailer.app_url(request)}/reset/{token}")
    await emailer.send_email(to=user["email"], subject="Reset your UE5 System Architect password", html=html)
    return reply


@router.post("/reset-password")
async def reset_password(body: ResetIn):
    rec = await db.password_reset_tokens.find_one_and_update({"token": body.token, "used": False}, {"$set": {"used": True}})
    if not rec or _aware(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Request a new one from the sign-in page.")
    await db.users.update_one({"user_id": rec["user_id"]}, {"$set": {"password_hash": hash_password(body.password)}, "$inc": {"token_version": 1}})
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
