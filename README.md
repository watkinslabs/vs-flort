# VS-Flort

A VSCode extension for file concatenation using the `flort` command-line tool. Concatenate multiple files into a single output with configurable profiles and filtering options.

## Features

- **Profile-based Configuration**: Predefined profiles for Python, JavaScript, C/C++, PHP, Markdown, and "All Files"
- **Visual Configuration Management**: Tree view interface for managing settings
- **Flexible File Selection**: Include/exclude patterns, extensions, and manual file selection
- **Output Control**: Directory tree generation, code outlines, manifests, and archiving
- **Workspace Integration**: Right-click context menus and command palette integration

## Requirements

Python 3.x with pip
flort Python package installed globally
VSCode ^1.74.0

## Installation
- Install the flort command-line tool
- Note flort works on the local system.  
- The package must be installed on that system, for isntance if you're connected to a remote server
- If you're using virtual environments it must be the one the IDE is using
- Otherwise you need to install it in a more global contexst like the user space

```bash
pip install flort --user
```

# Verify installation
flort --version

## Extension Installation

Install from the VSCode marketplace or manually:

```bash
# Install the extension
code --install-extension watkinslabs.vs-flort
```

## Usage

### Basic Commands

- **Flort**: Concatenate files using current profile settings
- **Flort with Profile**: Select a profile before concatenation

Access via:
- Command Palette (`Ctrl+Shift+P`): Search "Flort"
- Explorer context menu: Right-click files/folders
- Flort activity bar: Click the concatenate button

### Configuration Profiles

Seven predefined profiles are available:

| Profile | Extensions | Excludes | Features |
|---------|------------|----------|----------|
| Python | `.py` | `__pycache__`, `.pyc` | Code outline enabled |
| JavaScript | `.js`, `.ts`, `.jsx`, `.tsx` | `node_modules`, `dist` | Standard web dev setup |
| C | `.c`, `.h` | Build artifacts | Compiled language setup |
| C++ | `.cpp`, `.hpp`, `.h` | Build artifacts | Extended C++ support |
| PHP | `.php`, `.phtml` | `vendor`, `cache` | PHP project setup |
| Markdown | `.md`, `.markdown` | None | Documentation focus |
| All Files | All | Common temp files | Comprehensive inclusion |

### Profile Management

Use the Flort sidebar to:
- Switch between profiles
- Create custom profiles
- Modify inclusion/exclusion patterns
- Toggle output options
- Adjust advanced settings

### Configuration Options

#### File Selection
- **Patterns**: Glob patterns for file inclusion (e.g., `*.txt`)
- **Extensions**: File extensions to include
- **Manual Files**: Explicitly specified file paths

#### Filtering
- **Exclude Patterns**: Glob patterns to exclude
- **Exclude Extensions**: File extensions to exclude  
- **Exclude Directories**: Directory names to skip

#### Output Options
- **Show Config**: Display configuration in output
- **Skip Directory Tree**: Omit directory structure
- **Generate Code Outline**: Create function/class outlines (Python)
- **File Listing Only**: Create manifest without content
- **Skip File Content**: Generate tree and manifest only
- **Archive Type**: Create zip or tar.gz archives

#### Advanced Settings
- **Debug Output**: Enable detailed logging
- **Verbose Logging**: Extra execution details
- **Include All Files**: Override extension filtering
- **Include Hidden Files**: Process dotfiles
- **Include Binary Files**: Process non-text files
- **Max Directory Depth**: Limit traversal depth (0 = unlimited)

## Settings

Configuration is stored in workspace settings under the `flort` namespace:

```json
{
  "flort.currentProfile": "Python",
  "flort.patterns": ["*.test.*"],
  "flort.extensions": ["py"],
  "flort.excludePatterns": ["__pycache__/*"],
  "flort.debug": false
}
```

## Commands

| Command | Description |
|---------|-------------|
| `flort.concatenate` | Run flort with current settings |
| `flort.concatenateWithProfile` | Select profile and run |
| `flort.setProfile` | Switch active profile |
| `flort.addProfile` | Create new profile |
| `flort.addPattern` | Add inclusion pattern |
| `flort.addExtension` | Add file extension |
| `flort.addManualFile` | Add specific file |

## License

BSD 3-Clause License

## Repository

https://github.com/watkinslabs/vs-flort

## Author

Chris Watkins - chris@watkinslabs.com  
WatkinsLabs - https://watkinslabs.com