# TextMate Grammars

Place `.tmLanguage.json` grammar files here. File names should match
the language ID used in `monacoLanguageMap.ts`.

## Example

```
typescript.tmLanguage.json
python.tmLanguage.json
go.tmLanguage.json
```

## Where to get grammars

VS Code's built-in grammars:
https://github.com/microsoft/vscode/tree/main/extensions

Community grammars:
https://github.com/textmate

## Naming convention

The file name should be the key from the `SCOPE_FILE_MAP` in
`loadTextMateGrammar.ts`. For example, `source.ts` maps to
`typescript.tmLanguage.json`.
