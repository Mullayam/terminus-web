# Editor Themes

Place VS Code-compatible `.json` theme files here.

## Example

```
one-dark-pro.json
dracula.json
monokai.json
```

## JSON Format

```json
{
  "name": "Theme Name",
  "type": "dark",
  "colors": {
    "editor.background": "#1e1e1e",
    "editor.foreground": "#d4d4d4",
    ...
  },
  "tokenColors": [
    {
      "scope": "keyword",
      "settings": {
        "foreground": "#569cd6"
      }
    },
    ...
  ]
}
```

## Where to get themes

- VS Code Marketplace (themes are JSON files in `.vsix` packages)
- https://github.com/microsoft/vscode/tree/main/extensions/theme-defaults
- https://github.com/dracula/visual-studio-code
- https://github.com/one-dark/vscode-one-dark-theme
