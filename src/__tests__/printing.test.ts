import { buildLpArgs, validatePrintFile } from '../printing.js';

describe('buildLpArgs', () => {
  test('minimal', () => expect(buildLpArgs({ queue: 'Q' })).toEqual(['-d', 'Q']));
  test('duplex', () => expect(buildLpArgs({ queue: 'Q', duplex: true })).toEqual(['-d', 'Q', '-o', 'sides=two-sided-long-edge']));
  test('copies', () => expect(buildLpArgs({ queue: 'Q', copies: 3 })).toEqual(['-d', 'Q', '-n', '3']));
  test('pages', () => expect(buildLpArgs({ queue: 'Q', pages: '1-5' })).toEqual(['-d', 'Q', '-P', '1-5']));
  test('copies of 1 omitted', () => expect(buildLpArgs({ queue: 'Q', copies: 1 })).toEqual(['-d', 'Q']));
});

describe('validatePrintFile', () => {
  test('pdf ok', () => expect(() => validatePrintFile('a.pdf', 1000)).not.toThrow());
  test('uppercase ext ok', () => expect(() => validatePrintFile('a.PDF', 10)).not.toThrow());
  test('bad ext throws', () => expect(() => validatePrintFile('a.exe', 10)).toThrow());
  test('oversize throws', () => expect(() => validatePrintFile('a.pdf', 26 * 1024 * 1024)).toThrow());
  test('no ext throws', () => expect(() => validatePrintFile('Makefile', 10)).toThrow());
});
