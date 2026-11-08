# Auth Testing Playbook (UE5 System Architect)
Two sign-in methods share one users collection (custom `user_id`, unique `email`):
- Email/password: POST /api/auth/register | /api/auth/login -> httpOnly `access_token` (15m) + `refresh_token` (7d) JWT cookies. 5 failed logins per ip+email = 15 min lockout.
- Google (Emergent-managed): POST /api/auth/google {session_id} -> `session_token` cookie (7d) stored in `user_sessions`. Same email links to the existing account and marks email_verified=true.
- GET /api/auth/me accepts either cookie, or `Authorization: Bearer <access JWT or session_token>`.
- Password reset: admin-only POST /api/auth/admin/reset-link {email} -> token; user opens /reset/{token}; POST /api/auth/reset-password {token,password}. Single use, 1 hour.
Seed a Google-style test session:
mongosh --eval "use('test_database'); var u='test-user-'+Date.now(); var t='test_session_'+Date.now(); db.users.insertOne({user_id:u,email:'g.'+Date.now()+'@example.com',name:'G User',role:'user',email_verified:true,created_at:new Date()}); db.user_sessions.insertOne({user_id:u,session_token:t,expires_at:new Date(Date.now()+7*864e5),created_at:new Date()}); print(t)"
Credentials: /app/memory/test_credentials.md
