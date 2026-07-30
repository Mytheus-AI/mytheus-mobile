/**
 * Jest for the pure-TypeScript layer: the API client, its error model, hooks logic.
 *
 * Deliberately NOT jest-expo. That preset requires a newer React than this app runs, and
 * changing the app's React version to satisfy a test harness is the wrong way round. Component
 * and RNTL tests land with the preset once the versions line up; until then the layer that
 * carries the security-relevant behaviour (bearer injection, never sending org_id, RFC 7807
 * parsing) is fully covered here, because none of it imports React Native.
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', esModuleInterop: true } }],
  },
};
