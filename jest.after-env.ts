/* A test that makes React or a module warn fails, rather than passing with noise in the log: an
   act() warning means a state update the test never waited for, and a native module's warning
   means it reached code Jest should have replaced (jest.setup.ts). A test that expects a warning
   spies on the console itself. */
import { format } from 'node:util';

const heard: string[] = [];
const original = { error: console.error, warn: console.warn };

beforeEach(() => {
  heard.length = 0;
  console.error = (...args: unknown[]) => {
    heard.push(`console.error: ${format(...args)}`);
  };
  console.warn = (...args: unknown[]) => {
    heard.push(`console.warn: ${format(...args)}`);
  };
});

afterEach(() => {
  console.error = original.error;
  console.warn = original.warn;
  if (heard.length) {
    const said = heard.splice(0).join('\n\n');
    throw new Error(`The test wrote to the console:\n\n${said}`);
  }
});
