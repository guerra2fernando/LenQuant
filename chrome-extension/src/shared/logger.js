/**
 * Configurable logging for LenQuant extension
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

class Logger {
  constructor() {
    this.level = LOG_LEVELS.INFO;
    this.categories = new Set(['error', 'warn']);
    this.prefix = '[LenQuant]';
  }

  async init() {
    try {
      const result = await chrome.storage.local.get(['debugMode', 'logCategories']);
      if (result.debugMode) {
        this.level = LOG_LEVELS.DEBUG;
        this.categories = new Set(['error', 'warn', 'info', 'debug', 'dom', 'api', 'auth']);
      }
      if (result.logCategories) {
        this.categories = new Set(result.logCategories);
      }
    } catch (e) {
      // Ignore - use defaults
    }
  }

  setLevel(level) {
    this.level = level;
  }

  enableCategory(category) {
    this.categories.add(category);
  }

  disableCategory(category) {
    this.categories.delete(category);
  }

  log(category, ...args) {
    if (this.level >= LOG_LEVELS.DEBUG && this.categories.has(category)) {
      console.log(`${this.prefix}:${category}`, ...args);
    }
  }

  info(category, ...args) {
    if (this.level >= LOG_LEVELS.INFO) {
      console.info(`${this.prefix}:${category}`, ...args);
    }
  }

  warn(category, ...args) {
    if (this.level >= LOG_LEVELS.WARN) {
      console.warn(`${this.prefix}:${category}`, ...args);
    }
  }

  error(category, ...args) {
    // Always log errors
    console.error(`${this.prefix}:${category}`, ...args);
  }

  // Performance timing
  time(label) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.time(`${this.prefix} ${label}`);
    }
  }

  timeEnd(label) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.timeEnd(`${this.prefix} ${label}`);
    }
  }

  // Group for related logs
  group(label) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.group(`${this.prefix} ${label}`);
    }
  }

  groupEnd() {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.groupEnd();
    }
  }
}

export const logger = new Logger();
export { LOG_LEVELS };
