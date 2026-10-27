import type * as Monaco from 'monaco-editor'

type MonacoModule = typeof Monaco

export const TAXI_LANGUAGE_ID = 'taxi'

export const taxiLanguageConfiguration: Monaco.languages.LanguageConfiguration = {
  comments: { lineComment: '#' }
}

// Mirrors taxi's parser: stripped lines, `#` comment, else date, else entry; `=` flags pushed.
export const taxiMonarchLanguage: Monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.taxi',

  // Day-first or year-first with any non-digit separator; taxi ignores whatever follows.
  date: /(?:\d{1,2}\D\d{1,2}\D(?:\d{4}|\d{2})|\d{4}\D\d{1,2}\D\d{1,2})/,
  // Optional `?` flag (ignored on commit) before the alias.
  alias: /\s*(?:\?+\s+)?[?\w-]+/,
  // 09:00-10:30, 0900-?, -10:30, 1.5, .25
  duration: /(?:(?:\d{1,2}:?\d{1,2})?-(?:\d{1,2}:?\d{1,2}|\?)|\d+(?:\.\d+)?|\.\d+)/,

  tokenizer: {
    root: [
      [/^\s*#.*/, 'comment'],
      [/^\s*[?=]*=[?=]*\s.*/, 'comment'],
      [/^\s*@date/, 'type'],
      [/^(@alias)(\s+)(@duration)(\s+)(.+)$/, ['keyword', 'white', 'number', 'white', 'string']],
      [/^(@alias)(\s+)(@duration)(\s+)$/, ['keyword', 'white', 'number', 'white']],
      [/^(@alias)(\s+)(@duration)$/, ['keyword', 'white', 'number']],
      [/.+/, '']
    ]
  }
}

export function registerTaxiLanguage(monaco: MonacoModule): void {
  const languageAlreadyRegistered = monaco.languages
    .getLanguages()
    .some((language) => language.id === TAXI_LANGUAGE_ID)
  if (languageAlreadyRegistered) {
    return
  }

  monaco.languages.register({
    id: TAXI_LANGUAGE_ID,
    extensions: ['.tks'],
    aliases: ['Taxi', 'taxi']
  })
  monaco.languages.setLanguageConfiguration(TAXI_LANGUAGE_ID, taxiLanguageConfiguration)
  monaco.languages.setMonarchTokensProvider(TAXI_LANGUAGE_ID, taxiMonarchLanguage)
}
