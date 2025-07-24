// Jest setup file for enhanced agents
import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config();

// Set up test environment
process.env.NODE_ENV = 'test';

// Mock console methods if needed for cleaner test output
if (process.env.SILENT_TESTS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  } as Console;
}

// Global test timeout
jest.setTimeout(30000);

// Mock external dependencies that might be needed
jest.mock('@anthropic-ai/claude-code', () => ({
  query: jest.fn(),
}));