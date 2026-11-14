# Workspace UI

This is the React workspace for UE5 System Architect. The desktop app builds it and serves it locally.

See the README in the project root for how to install, add an API key, and build the Windows installer.

To work on the UI with a hot reload, build isn't required:

```bash
# terminal 1, from the project root
npm run server

# terminal 2
cd frontend
yarn start
```

Then open the address Yarn prints. Create `frontend/.env.local` with:

```
REACT_APP_BACKEND_URL=http://127.0.0.1:47321
```

so the UI talks to the local API instead of its own dev server.
