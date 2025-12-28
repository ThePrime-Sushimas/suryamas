module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/modules/employees/__tests__/setup.ts'],
  collectCoverageFrom: [
    'src/modules/**/*.ts',
    '!src/modules/**/*.types.ts',
    '!src/modules/**/*.routes.ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
}
