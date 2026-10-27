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

  // taxi accepts day-first and year-first dates with any non-digit separator.
  it.each(['27/10/2026', '27.10.26', '2026/10/27', '27-10-2026', '2026-1-2'])(
    'highlights the date header %s',
    (header) => {
      const [line] = tokenizeTaxi(header)

      expect(tokenTypeAt(line, 0)).toBe('type')
    }
  )

  it('keeps trailing text after a date header plain', () => {
    const [line] = tokenizeTaxi('27.10.2026 (Tuesday)')

    expect(tokenTypeAt(line, 0)).toBe('type')
    expect(tokenTypeAt(line, 11)).toBe('')
  })

  // Continuation, open-ended and ignored entries are legal taxi syntax.
  it.each([
    ['continuing the previous end time', 'alias -10:30 continued', 6],
    ['still running', 'alias 0900-? started', 6],
    ['ignored on commit', '?alias 1 ignored', 7],
    ['ignored with a spaced flag', '? alias 1 ignored', 8]
  ])('highlights the duration of an entry %s', (_name, entry, durationOffset) => {
    const [line] = tokenizeTaxi(entry)

    expect(tokenTypeAt(line, 0)).toBe('keyword')
    expect(tokenTypeAt(line, durationOffset)).toBe('number')
  })

  // taxi strips leading whitespace, so indentation must not drop a line to plain text.
  it('highlights indented entries, pushed entries and comments', () => {
    const [entry, tabbed, pushed, comment] = tokenizeTaxi(
      ['  alias 1 work', '\talias 1 work', '  = alias 1 pushed', '  # note'].join('\n')
    )

    expect(tokenTypeAt(entry, 2)).toBe('keyword')
    expect(tokenTypeAt(entry, 8)).toBe('number')
    expect(tokenTypeAt(entry, 10)).toBe('string')
    expect(tokenTypeAt(tabbed, 7)).toBe('number')
    expect(tokenTypeAt(pushed, 2)).toBe('comment')
    expect(tokenTypeAt(comment, 2)).toBe('comment')
  })

  it('treats combined ignored and pushed flags as pushed', () => {
    const [line] = tokenizeTaxi('?= alias 1 both')

    expect(tokenTypeAt(line, 0)).toBe('comment')
  })

  it('leaves lines taxi would reject plain', () => {
    const [badDuration, trailingJunk, prose] = tokenizeTaxi(
      ['alias ? work', 'alias 1.5x work', 'free text'].join('\n')
    )

    expect(tokenTypeAt(badDuration, 0)).toBe('')
    expect(tokenTypeAt(trailingJunk, 0)).toBe('')
    expect(tokenTypeAt(prose, 0)).toBe('')
  })

  it('does not carry an entry without description into the next line', () => {
    const [bare, next] = tokenizeTaxi('alias 2\n2026-10-27')

    expect(tokenTypeAt(bare, 6)).toBe('number')
    expect(tokenTypeAt(next, 0)).toBe('type')
  })
})
