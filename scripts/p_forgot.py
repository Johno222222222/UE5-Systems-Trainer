p='/app/backend/auth.py'; s=open(p).read()
def r(a,b):
    global s
    assert a in s, a[:70]; s=s.replace(a,b,1)
r('''@router.post("/reset-password")''','''class ForgotIn(BaseModel):
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


@router.post("/reset-password")''')
r('''This reset link is invalid or has expired. Ask the app owner for a new one.''','''This reset link is invalid or has expired. Request a new one from the sign-in page.''')
open(p,'w').write(s)
print("ok")
