# Flort

VSCode extension for preparing your codebase for AI analysis. Concatenates project files into AI-ready format for ChatGPT, Claude, GitHub Copilot, etc.

## Why Use This?

AI assistants need complete context to provide good code analysis, but dumping entire projects wastes tokens, reduces conversation length, and slows responses. Flort helps you be precise - select only relevant files while maintaining clear file structure so AI knows exactly what each piece of code is.

## Quick Start

1. Install: `pip install flort --user`
2. Install extension from VSCode marketplace
3. Right-click files/folders → **"Cherry Pick"** (only selected files) or **"Flort - Active Profile"** (uses current profile)
4. Copy output → paste into AI

## Profiles

| Profile | Use Case |
|---------|----------|
| **Cherry Pick** | Only outputs files/folders you specifically select |
| **Python** | Python projects with code outline |
| **JavaScript** | Web development, React/Node.js |
| **C/C++** | Systems programming |
| **PHP** | Web backend |
| **Markdown** | Documentation |
| **All Files** | Complete project overview |

## Installation

```bash
# Install flort command-line tool
pip install flort --user

# Verify installation
flort --version

# Install VSCode extension
code --install-extension watkinslabs.flort
```

**Note**: Install flort on the system where your code runs (local machine, remote server, etc.).

---

## Technical Details

### Configuration

Extensions are entered without dots: `py`, `js`, `cpp` (not `.py`, `.js`, `.cpp`)

Settings stored in workspace configuration:
```json
{
  "flort.currentProfile": "Python",
  "flort.extensions": ["py"],
  "flort.excludePatterns": ["__pycache__/*"]
}
```

### Commands

| Command | Description |
|---------|-------------|
| `flort.concatenate` | Run with current profile |
| `flort.runWithCherryPick` | Select specific files only |
| `flort.concatenateWithProfile` | Select profile and run |
| `flort.runWithAllFiles` | All Files profile |
| `flort.runWithPython` | Python profile |
| `flort.runWithJavaScript` | JavaScript profile |
| `flort.runWithC` | C profile |
| `flort.runWithCPlusPlus` | C++ profile |
| `flort.runWithPHP` | PHP profile |
| `flort.runWithMarkdown` | Markdown profile |
| `flort.setProfile` | Switch active profile |
| `flort.addProfile` | Create new profile |
| `flort.addPattern` | Add inclusion pattern |
| `flort.addExtension` | Add file extension |
| `flort.addManualFile` | Add specific file |
| `flort.addExcludePattern` | Add exclude pattern |
| `flort.addExcludeExtension` | Add exclude extension |
| `flort.addExcludeDir` | Add exclude directory |
| `flort.toggleSetting` | Toggle boolean setting |
| `flort.editSetting` | Edit setting value |
| `flort.refreshProfiles` | Refresh profile view |

### Requirements

- Python 3.x with pip
- VSCode ^1.74.0

### License

BSD 3-Clause

### Repository


| Component  | Repo |
|---------|-------------|
| Extensiopn | https://github.com/watkinslabs/vs-flort |
| CLI Tool | https://github.com/watkinslabs/flort |

### Author

Chris Watkins - chris@watkinslabs.com