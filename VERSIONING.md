# Versioning

UE5 System Architect uses `MAJOR.MINOR.PATCH` in the root `package.json`. That number is the app version. The Windows installer, the in-app update check, and the Feedback issue all read it. Do not keep a second copy.

## How the number moves

- **1.0.0** is the desktop app with Stage 0 (new project, Target Unreal, Feedback, release tags, bench). That stage is already merged.
- A fix before the next stage bumps the **patch**: `1.0.1`, `1.0.2`, and so on.
- A new stage bumps the **minor** and resets the patch. Stage 1 is **1.1.0**, Stage 2 is **1.2.0**, Stage 3 is **1.3.0**, Stage 4 is **1.4.0**, and Stage 5 is **1.5.0**. The next stage will be **1.6.0**.
- The major number stays at 1 until the owner decides the app has broken existing projects on purpose.

## Releasing

1. Merge the stage (or the fix) to `main`.
2. Check `package.json` `"version"` is the number you want to ship. This branch sets it to `1.5.0`.
3. Tag that commit and push the tag. Do not tag from an unmerged branch.

```powershell
git checkout main
git pull
git tag v1.5.0
git push origin v1.5.0
```

The tag must look like `v1.5.0` (a `v`, then the same three numbers as `package.json`). GitHub Actions builds the Windows installer and attaches it to a GitHub Release for that tag. The app asks GitHub for the latest release on startup and shows an Update chip only when that release is newer than the running version.

This file does not create a tag. Tagging is the owner's step after review.
