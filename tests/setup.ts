// Jest setup file
import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config();

// Set up test environment
process.env.NODE_ENV = 'test';

// Mock console.log in tests if needed
if (process.env.SILENT_TESTS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}