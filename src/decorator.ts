import { window, Position, Range, TextEditorDecorationType } from 'vscode';

export const onHighlightLine = (
  lines: number[],
  decorationType: TextEditorDecorationType
): void => {

  if (!decorationType) {
    return;
  }

  const editor = window.activeTextEditor;
  if (!editor) {
    return;
  }

  const currentLineNumber = window.activeTextEditor?.selection.active.line || 0;
  const ranges = lines.map(line => {

    // don't busy up the currently focused line
    if (line === currentLineNumber) {
      return;
    }

    const range = new Range(
      new Position(line, 0),
      new Position(line, 500),
    );

    return range;
  }).filter(d => d) as Range[];



  editor.setDecorations(decorationType, ranges);

};