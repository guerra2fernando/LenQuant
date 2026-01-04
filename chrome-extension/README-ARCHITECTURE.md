# LenQuant Extension - Modular Architecture

This document describes the new modular architecture implemented in Phase 5.

## Directory Structure

```
chrome-extension/
├── src/                          # Source code (ES6 modules)
│   ├── background/               # Background script
│   │   └── index.js             # Main background entry point
│   ├── content/                  # Content script modules
│   │   ├── index.js             # Content script entry point
│   │   ├── dom-extractors.js    # DOM data extraction
│   │   ├── context-observer.js  # Context change observation
│   │   └── panel/               # Trading panel components
│   │       ├── index.js         # Panel main class
│   │       ├── template.js      # HTML templates
│   │       ├── updater.js       # Panel content updates
│   │       ├── drag-handler.js  # Panel dragging
│   │       └── storage.js       # Panel position storage
│   ├── shared/                   # Shared utilities
│   │   ├── config.js            # Configuration constants
│   │   ├── logger.js            # Logging utilities
│   │   ├── oauth.js             # OAuth helpers
│   │   └── api-helpers.js       # API communication helpers
│   └── popup/                    # Popup script
│       └── popup.js             # Popup functionality
├── dist/                         # Built/bundled files (generated)
│   ├── background.js
│   ├── content.js
│   └── popup.js
├── docs/                         # Documentation
├── package.json                  # Build dependencies
├── rollup.config.js             # Build configuration
├── .eslintrc.json              # Linting configuration
└── manifest.json               # Extension manifest
```

## Building

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Build and watch for development
npm run watch

# Lint code
npm run lint
```

## Key Improvements

1. **Modular Structure**: Code is organized into logical modules instead of monolithic files
2. **ES6 Modules**: Modern JavaScript module system for better dependency management
3. **Shared Utilities**: Common functionality extracted to reusable modules
4. **Build System**: Automated bundling and minification with Rollup
5. **Code Quality**: ESLint integration for consistent code standards
6. **Maintainability**: Easier to understand, test, and modify individual components

## Migration Notes

- The extension now uses `dist/` files in production instead of source files
- Manifest.json has been updated to reference the built files
- All functionality has been preserved while improving code organization
- The build process must be run before deploying the extension

## Development Workflow

1. Make changes to files in `src/`
2. Run `npm run build` to generate `dist/` files
3. Test the extension with the built files
4. Run `npm run lint` to check code quality

## Benefits Achieved

- **Reduced Complexity**: Main content script reduced from 3533 lines to ~120 lines
- **Better Organization**: 15+ distinct modules vs 6 monolithic files
- **Eliminated Duplication**: OAuth logic consolidated from 2 files to 1 shared module
- **Improved Maintainability**: Each module has a single responsibility
- **Enhanced Testability**: Individual modules can be tested in isolation
