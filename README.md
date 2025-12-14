# Link Password

Link Password is a secure, lightweight, and modern password manager built with **Tauri**, **React**, and **TypeScript**. It combines the performance and security of Rust with the flexibility of a modern web frontend.

![](./docs/img.png)

## Features

- **💾 Data Autonomy**: Complete control over your data. Validates the principle of data sovereignty by allowing custom storage paths.
- **🔒 Secure Storage**: AES encryption for all your passwords.
- **⚡ Fast & Lightweight**: Native performance powered by Tauri (Rust).
- **🎨 Modern UI**: Clean interface with Dark/Light mode support (adapts to system settings).
- **👆 Drag & Drop**: Easily reorder your accounts with drag-and-drop functionality.
- **🔍 Quick Search**: Instantly filter and find your accounts.
- **📋 One-Click Copy**: Copy passwords to clipboard securely and quickly.


## Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Backend / Core**: Tauri (Rust)
- **State / Logic**: React Hooks
- **Drag & Drop**: @dnd-kit

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) & [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install)

### Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run in development mode:
   ```bash
   pnpm tauri dev
   ```

### Build

To build the application for production:

```bash
pnpm tauri build
```

The output will be in `src-tauri/target/release/bundle`.

## Usage

1. **Add Account**: Click the `+` button, enter an account name and password. You can optionally set a master password to encrypt this specific entry.
2. **Unlock**: Click on a hidden password and enter the master password to reveal/copy it.
3. **Reorder**: Drag items in the list to your preferred order.
4. **Settings**: Click the gear icon to change the storage path or switch themes.

## License

[CC BY-NC 4.0](LICENSE)
