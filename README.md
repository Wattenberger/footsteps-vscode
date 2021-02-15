# 👣 Footsteps 🐾

Keep your place when jumping between a different parts of your code. This is a VSCode extension that will highlight lines as you edit them, fading as you move away.

Jump between lines using `ctrl+alt+left` and `ctrl+alt+right`.

![The extension in-action](https://github.com/Wattenberger/footsteps-vscode/blob/main/footsteps.gif?raw=true)

## Extension Settings

This extension allows the following settings:

* `footsteps.highlightColor`

  Default: `"rgb(153, 128, 250)"`

  The color of the highlighted trail (in rgb format). I'd recommend keeping this subtle - black (`rgb(0, 0, 0)`) if you have a dark theme and white (`rgb(255, 255, 255)`) if you have a light theme.

* `footsteps.highlightColorMaxOpacity`

  Default: `0.4`

  The maximum opacity for line highlights (`0` - `1`) - higher number means a more opaque highlight.

* `footsteps.doHighlightChanges`

  Default: `true`

  Whether or not to add line highlights. If this is `false`, it will still allow navigation between chunks.

* `footsteps.doHighlightCurrentlyFocusedChunk`

  Default: `false`

  Whether or not to highlight the actively focused chunk. It can be distracting to highlight the code you're actively working on, so this is off by default.

* `footsteps.maxNumberOfChangesToRemember`

  Default: `6`

  The number of changes to save in history

* `footsteps.maxNumberOfChangesToHighlight`

  Default: `10`

  The number of changes to highlight. A lower number drops off more quickly.


## Commands

This extension doesn't have any default commands, to prevent from clashing with your setup. Bind your own keybindings to these commands:

* `footsteps.skipBack`

  Skip back in footsteps. Default: `ctrl+alt+left`

* `footsteps.skipForwards`

  Skip forwards in footsteps. Default: `ctrl+alt+right`

* `footsteps.skipBackSameFile`

  Skip back in footsteps (stay in the same file)

* `footsteps.skipForwardsSameFile`

  Skip forwards in footsteps (stay in the same file)

* `footsteps.skipBackDifferentFile`

  Skip back in footsteps (skip between files)

* `footsteps.skipForwardsDifferentFile`

  Skip forwards in footsteps (skip between files)

* `footsteps.clearChangesWithinFile`

  Clear all changes within file (useful when you've edited the whole file)

* `footsteps.toggleHighlightingLines`

  Toggle the `footsteps.doHighlightChanges` setting: whether or not we are highlighting lines

## 🤝 How to Contribute

I'd love suggestions on how to improve the extension (feature requests) or code suggestions.

## 📝 License

Licensed under the MIT License.