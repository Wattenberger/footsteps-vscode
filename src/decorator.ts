import { window, Position, Range, TextEditorDecorationType } from 'vscode';

export const onHighlightLine = (range: Range, decorationType: TextEditorDecorationType): void => {

  let ranges = [];
  // don't busy up the currently focused line
  const currentLineNumber = window.activeTextEditor?.selection.active.line || 0;
  if (range.start.line <= currentLineNumber && range.end.line >= currentLineNumber) {

    // don't draw current line
    if (currentLineNumber === range.start.line && currentLineNumber === range.end.line) {
      return;
    }

    const topRange = currentLineNumber === range.start.line ? null :
      new Range(
        new Position(range.start.line, 0),
        new Position(currentLineNumber - 1, 0),
      );
    const bottomRange = currentLineNumber === range.end.line ? null :
      new Range(
        new Position(currentLineNumber + 1, 0),
        new Position(range.end.line, 500),
      );
    ranges = [topRange, bottomRange].filter(d => d);
  } else {
    ranges = [range];
  }

  const editor = window.activeTextEditor;
  if (!editor) {
    return;
  }

  if (!decorationType) {
    return;
  }

  editor.setDecorations(decorationType, ranges);
};