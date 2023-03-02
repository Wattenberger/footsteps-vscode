import { Position, Range, TextEditorDecorationType, TextEditor } from 'vscode';

export const onHighlightLine = (
  editor: TextEditor,
  lines: number[],
  decorationType: TextEditorDecorationType
): void => {

  if (!decorationType) return;

  const ranges = lines.map(line => {
    const range = new Range(
      new Position(line, 0),
      new Position(line, 500),
    );

    return range;
  }).filter(d => d) as Range[];

  editor.setDecorations(decorationType, ranges);

};