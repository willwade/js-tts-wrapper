// Jest mock for espeak-ng ESM-only module
module.exports = {
  synthesize: jest.fn(async (text, options) => ({ buffer: new Uint8Array([1,2,3]) })),
};
