# Versioning

UE5 Systems Training Tool/Generator uses `MAJOR.MINOR.PATCH` in the root `package.json`. That number is the app version. The Windows installer, the in-app update check, and the Feedback issue all read it. Do not keep a second copy.

## How the number moves

- **1.0.0** is the desktop app with Stage 0 (new project, Target Unreal, Feedback, release tags, bench). That stage is already merged.
- A fix before the next stage bumps the **patch**: `1.0.1`, `1.0.2`, and so on.
- A new stage bumps the **minor** and resets the patch. Stage 1 is **1.1.0**, Stage 2 is **1.2.0**, Stage 3 is **1.3.0**, Stage 4 is **1.4.0**, Stage 5 is **1.5.0**, Stage 6 is **1.6.0**, Stage 7 is **1.7.0**, Stage 8 is **1.8.0**, Stage 9 is **1.9.0**, Stage 10 is **1.10.0**, Stage 11 is **1.11.0**, Stage 12 is **1.12.0**, Stage 13 is **1.13.0**, Stage 14 is **1.14.0** (patch **1.14.1**), Stage 15 is **1.15.0**, Stage 16 is **1.16.0**, Stage 17 is **1.17.0**, and Stage 18 is **1.18.0**. The next stage will be **1.19.0**.
- The major number stays at 1 until the owner decides the app has broken existing projects on purpose.

## Releasing

1. Merge the stage (or the fix) to `main`.
2. Check `package.json` `"version"` is the number you want to ship. This branch sets it to `1.18.0`.
3. Tag that commit and push the tag. Do not tag from an unmerged branch.

```powershell
git checkout main
git pull
git tag v1.18.0
git push origin v1.18.0
```

The tag must look like `v1.18.0` (a `v`, then the same three numbers as `package.json`). GitHub Actions builds the Windows installer and attaches it to a GitHub Release for that tag. The app asks GitHub for the latest release on startup and shows an Update chip only when that release is newer than the running version.

This file does not create a tag. Tagging is the owner's step after review.
