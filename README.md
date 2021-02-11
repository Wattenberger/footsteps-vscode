# 👣 Footsteps 🐾

Keep your place when jumping between a different parts of your code. This is a vscode extension that will highlight lines as you edit them, fading as you move away.

![The extension in-action](https://github.com/Wattenberger/footsteps-vscode/blob/main/footsteps.gif?raw=true)

## Extension Settings

This extension contributes the following settings:

* `footsteps.highlightColor`

  The color of the highlighted trail (in rgb format)

* `footsteps.maxNumberOfChangesToRemember`

  The number of changes to save in history

  d

* `footsteps.maxNumberOfChangesToHighlight`

  The number of changes to highlight. A lower number drops off more quickly.


## Commands

This extension doesn't have any default commands, to prevent from clashing with your setup. Bind your own keybindings to these commands:

* `footsteps.skipBack`

  Skip back in footsteps. Suggested: `alt+ctrl+left`

* `footsteps.skipForwards`

  Skip forwards in footsteps. Suggested: `alt+ctrl+right`

* `footsteps.skipBackSameFile`

  Skip back in footsteps (stay in the same file)

* `footsteps.skipForwardsSameFile`

  Skip forwards in footsteps (stay in the same file)

* `footsteps.skipBackDifferentFile`

  Skip back in footsteps (skip between files)

* `footsteps.skipForwardsDifferentFile`

  Skip forwards in footsteps (skip between files)

