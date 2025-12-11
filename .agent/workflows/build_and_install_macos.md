---
description: Build and install the macOS application
---

# Build and Install macOS App

This workflow describes how to build the release version of the application and install it on macOS.

## Prerequisites
- Ensure all dependencies are installed: `pnpm install`
- Ensure code is committed (optional but good practice).

## Build Command

Run the following command in the project root:

```bash
pnpm tauri build
```

This command will:
1. Build the frontend (React/Vite) into `dist/`.
2. Compile the Rust backend in release mode.
3. Bundle the application into a `.dmg` and `.app`.

## Installation

Once the build is complete, you can find the artifacts in:

**DMG File (Installer):**
`src-tauri/target/release/bundle/dmg/link1987-password_0.1.0_aarch64.dmg` (or `x86_64` depending on your Mac)

**App Bundle (Direct Executable):**
`src-tauri/target/release/bundle/macos/link1987-password.app`

### To Install:
1. Open the finder to the dmg location:
   ```bash
   open src-tauri/target/release/bundle/dmg/
   ```
2. Double-click the `.dmg` file.
3. Drag `link1987-password.app` into the `Applications` folder shortcut.

## Troubleshooting

- **Signing Issues**: If you see warnings about code signing, you can still run the app locally. You might need to right-click open it the first time if Gatekeeper blocks it, or use `xattr -cr /path/to/app` to clear quarantine attributes.
