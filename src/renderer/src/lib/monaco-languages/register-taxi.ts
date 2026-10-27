import type * as Monaco from 'monaco-editor'

type MonacoModule = typeof Monaco

export const TAXI_LANGUAGE_ID = 'taxi'

export const taxiLanguageConfiguration: Monaco.languages.LanguageConfiguration = {
  comments: { lineComment: '#' }
}

// Taxi timesheets: `alias duration description` entries under a date line; `=` marks pushed ones.
export const taxiMonarchLanguage: Monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  tokenPostfix: '.taxi',

  date: /(?:\d{1,2}[/.]\d{1,2}[/.]\d{2,4}|\d{4}-\d{2}-\d{2})/,
  // 09:00-10:30, 0900-?, -10:30, 1.5, .25
  duration: /[0-9.:?-]+/,
  // An optional `?` flag marks an entry taxi ignores on commit.
  alias: /(?:\?\s*)?[^\s?]\S*/,

  tokenizer: {
    root: [
      [/#.*/, 'comment'],
      [/=.*/, 'comment'],
      [/^@date\s*$/, 'type'],
      [/^(@alias)(\s+)(@duration)(\s+)(.+)/, ['keyword', 'white', 'number', 'white', 'string']],
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
