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

  const ranges = lines.map(line => {
    const range = new Range(
      new Position(line, 0),
      new Position(line, 500),
    );

    return range;
  }).filter(d => d) as Range[];



  editor.setDecorations(decorationType, ranges);

};