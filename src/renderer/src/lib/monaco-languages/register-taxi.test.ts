import { describe, expect, it, vi } from 'vitest'
import { tokenizeMonarchDocument, tokenTypeAt } from './monarch-tokenizer-test-harness'
import {
  TAXI_LANGUAGE_ID,
  registerTaxiLanguage,
  taxiLanguageConfiguration,
  taxiMonarchLanguage
} from './register-taxi'

function tokenizeTaxi(source: string) {
  return tokenizeMonarchDocument(TAXI_LANGUAGE_ID, taxiMonarchLanguage, source)
}

function createMonacoMock(existingLanguageIds: string[] = []) {
  return {
    languages: {
      getLanguages: vi.fn(() => existingLanguageIds.map((id) => ({ id }))),
      register: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      setMonarchTokensProvider: vi.fn()
    }
  }
}

describe('registerTaxiLanguage', () => {
  it('registers the taxi language with a Monarch tokenizer and .tks extension', () => {
    const monaco = createMonacoMock()

    registerTaxiLanguage(monaco as never)

    expect(monaco.languages.register).toHaveBeenCalledWith(
      expect.objectContaining({ id: TAXI_LANGUAGE_ID, extensions: ['.tks'] })
    )
    expect(monaco.languages.setLanguageConfiguration).toHaveBeenCalledWith(
      TAXI_LANGUAGE_ID,
      taxiLanguageConfiguration
    )
    expect(monaco.languages.setMonarchTokensProvider).toHaveBeenCalledWith(
      TAXI_LANGUAGE_ID,
      taxiMonarchLanguage
    )
  })

  it('registers once and is idempotent when the language already exists', () => {
    const monaco = createMonacoMock([TAXI_LANGUAGE_ID])

    registerTaxiLanguage(monaco as never)

    expect(monaco.languages.register).not.toHaveBeenCalled()
    expect(monaco.languages.setMonarchTokensProvider).not.toHaveBeenCalled()
  })
})

describe('taxi tokenization', () => {
  it('colours a day of entries by alias, duration and description', () => {
    const [date, ranged, decimal, pushed, comment] = tokenizeTaxi(
      [
        '27/10/2026',
        'mobi_cpartd105 04:00-07:00 SHCWS-1983: visuelle Optimierungen',
        '_genai_admin .25 admin (https://example.com/deal/1)',
        '= _wombats_admin .25 admin',
        '# review before commit'
      ].join('\n')
    )

    expect(tokenTypeAt(date, 0)).toBe('type')
    expect(tokenTypeAt(ranged, 0)).toBe('keyword')
    expect(tokenTypeAt(ranged, 15)).toBe('number')
    expect(tokenTypeAt(ranged, 27)).toBe('string')
    expect(tokenTypeAt(decimal, 13)).toBe('number')
    expect(tokenTypeAt(decimal, 17)).toBe('string')
    expect(tokenTypeAt(pushed, 0)).toBe('comment')
    expect(tokenTypeAt(comment, 0)).toBe('comment')
  })

  // Continuation, open-ended and ignored entries are legal taxi syntax.
  it.each([
    ['continuing the previous end time', 'alias -10:30 continued', 6],
    ['still running', 'alias 0900-? started', 6],
    ['ignored on commit', '?alias 1 ignored', 7]
  ])('highlights the duration of an entry %s', (_name, entry, durationOffset) => {
    const [line] = tokenizeTaxi(entry)

    expect(tokenTypeAt(line, 0)).toBe('keyword')
    expect(tokenTypeAt(line, durationOffset)).toBe('number')
  })

  it('does not carry an entry without description into the next line', () => {
    const [bare, next, prose] = tokenizeTaxi('alias 2\n2026-10-27\nfree text')

    expect(tokenTypeAt(bare, 6)).toBe('number')
    expect(tokenTypeAt(next, 0)).toBe('type')
    expect(tokenTypeAt(prose, 0)).toBe('')
  })
})
