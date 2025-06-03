# Makefile for VSCode Flort Extension
# Requires: npm, vsce (Visual Studio Code Extension manager)

# Variables
EXTENSION_NAME = wl-flort
VERSION = $(shell node -p "require('./package.json').version")
VSIX_FILE = $(EXTENSION_NAME)-$(VERSION).vsix

# Default target
.PHONY: all
all: build

# Install dependencies
.PHONY: install
install:
	@echo "Installing dependencies..."
	npm install
	@echo "Installing vsce globally (if not already installed)..."
	npm list -g @vscode/vsce > /dev/null 2>&1 || npm install -g @vscode/vsce

# Build the extension package
.PHONY: build
build: install
	@echo "Building extension package..."
	vsce package
	@echo "Extension package created: $(VSIX_FILE)"

# Install the extension locally
.PHONY: install-local
install-local: build
	@echo "Installing extension locally..."
	code --install-extension $(VSIX_FILE)
	@echo "Extension installed successfully!"

# Uninstall the extension
.PHONY: uninstall
uninstall:
	@echo "Uninstalling extension..."
	code --uninstall-extension WatkinsLabs.$(EXTENSION_NAME)

# Reinstall (uninstall then install)
.PHONY: reinstall
reinstall: uninstall install-local

# Clean build artifacts
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	rm -f *.vsix
	rm -rf node_modules/

# Development: install dependencies and link for development
.PHONY: dev
dev: install
	@echo "Setting up for development..."
	@echo "Extension ready for development testing"

# Publish to VSCode Marketplace (requires authentication)
.PHONY: publish
publish: build
	@echo "Publishing to VSCode Marketplace..."
	@echo "Note: You must be logged in with 'vsce login'"
	vsce publish

# Show extension info
.PHONY: info
info:
	@echo "Extension Name: $(EXTENSION_NAME)"
	@echo "Version: $(VERSION)"
	@echo "Package File: $(VSIX_FILE)"
	@echo "Publisher: WatkinsLabs"

# Validate package without building
.PHONY: validate
validate: install
	@echo "Validating extension package..."
	vsce package --no-dependencies

# List installed extensions (to verify installation)
.PHONY: list-extensions
list-extensions:
	@echo "Installed VSCode extensions:"
	code --list-extensions | grep -i flort || echo "Flort extension not found"

# Help target
.PHONY: help
help:
	@echo "Available targets:"
	@echo "  install        - Install npm dependencies and vsce"
	@echo "  build          - Build the extension package (.vsix)"
	@echo "  install-local  - Install extension locally in VSCode"
	@echo "  uninstall      - Remove extension from VSCode"
	@echo "  reinstall      - Uninstall and reinstall extension"
	@echo "  dev            - Set up for development"
	@echo "  clean          - Remove build artifacts"
	@echo "  publish        - Publish to VSCode Marketplace"
	@echo "  validate       - Validate package without building"
	@echo "  info           - Show extension information"
	@echo "  list-extensions- List installed extensions"
	@echo "  help           - Show this help message"