import {
    Position,
    Range,
    Selection,
    TextDocument,
    TextDocumentContentChangeEvent,
    TextEditor,
    TextEditorDecorationType,
    Uri,
    window,
    workspace
} from "vscode";

import { onHighlightLine } from "./decorator";
import { History, HistoryItem } from "./types";

export class FootstepsProvider {
    private history: History = [];
    private currentHistoryIndex: number = 0;
    private decorationTypes: TextEditorDecorationType[][] = [];
    private editorFileNames: string[] = []
    private maxNumberOfChangesToRemember: number = 10;
    private clearChangesOnFileSave: boolean = false;
    private maxNumberOfChangesToHighlight: number = 6;
    private minDistanceFromCursorToHighlight: number = 3;
    private highlightColor: string = "rgb(255, 99, 72)";
    private doHighlightChanges: boolean = true;
    private doHighlightOnClick: boolean = true;
    private doHighlightChangesPerLanguage: Record<string, boolean> = {};
    private doHighlightEmptyLines: boolean = true;
    private doHighlightInactiveEditors: boolean = true;
    private highlightColorMaxOpacity: number = 0.6;
    private doHighlightCurrentlyFocusedChunk: boolean = true;

    constructor() {
        this.onSyncWithSettings();
        this.createDecorationTypes();

        window.onDidChangeActiveTextEditor(() => {
            this.onHighlightChanges();
        });

        window.onDidChangeTextEditorSelection(({ kind }) => {
            const didClick = kind === 2;
            const doIncludeCurrentRange = this.doHighlightOnClick && didClick;
            if (doIncludeCurrentRange) {
                const editor = window.activeTextEditor;
                if (!editor) return;
                const fileName = editor.document.fileName || "";
                const line = editor.selection.active.line;
                const lineLength = editor.document.lineAt(line).text.length;
                this.addChangeToHistory(fileName, [line], lineLength);
            }
            this.onHighlightChanges();
        });

        workspace.onDidChangeConfiguration((event) => {
            if (!event.affectsConfiguration("footsteps")) {
                return;
            }
            this.onSyncWithSettings();
            this.createDecorationTypes();
        });

        workspace.onDidSaveTextDocument((document) => {
            const editor = window.activeTextEditor;
            if (this.clearChangesOnFileSave && editor) {
                this.onClearChangesWithinFile(document, editor);
            }
        });

    }

    private onSyncWithSettings(): void {
        const userSetting = workspace.getConfiguration("footsteps");

        if (this.doHighlightChanges && !userSetting.doHighlightChanges) {
            this.clearChanges();
        }

        this.maxNumberOfChangesToRemember =
            userSetting.maxNumberOfChangesToRemember;
        this.clearChangesOnFileSave = userSetting.clearChangesOnFileSave;
        this.maxNumberOfChangesToHighlight =
            userSetting.maxNumberOfChangesToHighlight;
        this.minDistanceFromCursorToHighlight =
            userSetting.minDistanceFromCursorToHighlight;
        this.highlightColor = userSetting.highlightColor;
        this.doHighlightChanges = userSetting.doHighlightChanges;
        this.doHighlightOnClick = userSetting.doHighlightOnClick;
        this.doHighlightEmptyLines = userSetting.doHighlightEmptyLines;
        this.doHighlightInactiveEditors = userSetting.doHighlightInactiveEditors;
        this.highlightColorMaxOpacity = userSetting.highlightColorMaxOpacity;
        this.doHighlightCurrentlyFocusedChunk =
            userSetting.doHighlightCurrentlyFocusedChunk;
        this.doHighlightChangesPerLanguage = {};
    }

    private createDecorationTypes(): void {
        const maxFilesToHighlight = 10;
        this.decorationTypes = new Array(maxFilesToHighlight).fill(0).map(() => (
            this.getDecorationTypes()
        ))
    }

    private getDecorationTypes(): TextEditorDecorationType[] {
        const getOpacity = (index: number) => {
            const percentAlong = index / this.maxNumberOfChangesToHighlight;
            return this.highlightColorMaxOpacity * (1 - percentAlong);
        };

        return new Array(this.maxNumberOfChangesToHighlight).fill(0).map((_, i) =>
            window.createTextEditorDecorationType({
                backgroundColor: [
                    this.highlightColor.replace("rgb", "rgba").replace(/\)/g, ""),
                    ", ",
                    getOpacity(i),
                    ")",
                ].join(""),
                isWholeLine: true,
            })
        )
    }

    private isCodeEditor(document: TextDocument): boolean {
        return document.uri.scheme === "file";
    }

    public async onHighlightChanges(): Promise<void> {
        if (!this.doHighlightChanges) return;

        const highlightChangesInEditor = (editor: TextEditor, editorIndex: number) => {
            const uri = editor.document.uri.fsPath;
            if (this.editorFileNames[editorIndex] !== uri) {
                const existingIndex = this.editorFileNames.indexOf(uri);
                if (existingIndex !== -1) {
                    this.clearChanges(existingIndex);
                }
                this.editorFileNames[editorIndex] = uri;
            }

            this.clearChanges(editorIndex);
            const isCodeEditor = this.isCodeEditor(editor.document);
            if (!isCodeEditor) return;

            const language = editor.document.languageId;
            const doHighlightChangesForLanguage = this.doHighlightChangesPerLanguage[language]
                || workspace.getConfiguration("footsteps", {
                    languageId: language,
                }).doHighlightChanges;
            if (!doHighlightChangesForLanguage) return;

            const fileName = editor.document.fileName || "";

            let currentRange: number[] = [0, 0];
            if (editor?.selection) {
                currentRange = [editor.selection.start.line, editor.selection.end.line];
            }

            const fileChanges = this.getChangesInFile(fileName);

            fileChanges.forEach(([_, lines], index: number) => {
                let linesOutsideOfCursorRange = lines;
                if (editor.selection) {
                    if (!this.doHighlightCurrentlyFocusedChunk) {
                        const linesRange = [Math.min(...lines), Math.max(...lines)];
                        const isCurrentChunk =
                            linesRange[0] <= currentRange[0] && linesRange[1] >= currentRange[1];
                        if (isCurrentChunk) {
                            onHighlightLine(editor, linesRange, this.clearDecoration);
                            return;
                        }
                    }
                    if (this.minDistanceFromCursorToHighlight) {
                        linesOutsideOfCursorRange = lines.filter(line => {
                            const isLineAboveCursor = line < currentRange[0] - this.minDistanceFromCursorToHighlight;
                            const isLineBelowCursor = line > currentRange[1] + this.minDistanceFromCursorToHighlight;
                            const doShow = isLineAboveCursor || isLineBelowCursor;
                            if (!doShow) {
                                onHighlightLine(editor, [line], this.clearDecoration);
                            }
                            return doShow;
                        });
                    }
                }
                if (!this.decorationTypes?.[editorIndex]?.[index]) return;
                onHighlightLine(editor, linesOutsideOfCursorRange, this.decorationTypes[editorIndex][index]);
            });
        };

        const editors = this.doHighlightInactiveEditors ? window.visibleTextEditors : [window.activeTextEditor];
        editors.forEach((editor, i) => {
            if (!editor) return;
            highlightChangesInEditor(editor, i);
        });
    }

    private addChangeToHistory(
        fileName: string,
        lines: number[],
        character: number
    ): void {
        this.currentHistoryIndex = 0;

        const overlappingChangeIndex = this.history
            .slice(0, this.maxNumberOfChangesToHighlight)
            .findIndex(
                ([changeFileName, changeLines]: HistoryItem) =>
                    changeFileName === fileName &&
                    changeLines.find(
                        (line) =>
                            lines.includes(line) ||
                            lines.includes(line - 1) ||
                            lines.includes(line + 1)
                    )
            );

        const lastPosition = [lines.slice(-1)[0], character];

        if (overlappingChangeIndex !== -1) {
            const oldLines = this.history[overlappingChangeIndex][1];
            const newLines = [...new Set([...lines, ...oldLines])];
            this.history = [
                [fileName, newLines, lastPosition],
                ...this.history.slice(0, overlappingChangeIndex),
                ...this.history.slice(overlappingChangeIndex + 1),
            ];
        } else {
            this.history = [[fileName, lines, lastPosition], ...this.history];
        }
        this.history = this.history.slice(0, this.maxNumberOfChangesToRemember);
    }

    private getChangesInFile(fileName: string): History {
        return this.history.filter(
            ([changeFileName]: HistoryItem) => changeFileName === fileName
        );
    }
    private getChangesInOtherFiles(fileName: string): History {
        return this.history.filter(
            ([changeFileName]: HistoryItem) => changeFileName !== fileName
        );
    }

    public onTimeTravel(
        diff: number = 0,
        restriction: "any" | "within-file" | "across-files" = "any"
    ): void {
        const editor = window.activeTextEditor;
        const fileName = editor?.document.fileName || "";

        const changes =
            restriction === "any"
                ? this.history
                : restriction === "within-file"
                    ? this.getChangesInFile(fileName)
                    : restriction === "across-files"
                        ? this.getChangesInOtherFiles(fileName)
                        : [];

        let newHistoryIndex = this.currentHistoryIndex - diff;
        newHistoryIndex = Math.max(0, newHistoryIndex);
        newHistoryIndex = Math.min(newHistoryIndex, changes.length - 1);
        const [newFileName, newLines, newPosition] = changes[newHistoryIndex];

        if (!newLines) {
            return;
        }

        this.currentHistoryIndex = newHistoryIndex;

        const newSelectionLine = newPosition[0];
        const newSelectionChar = newPosition[1] + 1;

        this.onUpdateSelection(newFileName, newSelectionLine, newSelectionChar);
    }

    private onUpdateSelection(
        fileName: string,
        line: number,
        character: number
    ): void {
        const editor = window.activeTextEditor;

        const newPosition = new Position(line, character);
        const newSelection = new Selection(newPosition, newPosition);

        const newVisibleRange = new Range(
            new Position(line, character),
            new Position(line, character)
        );

        workspace.openTextDocument(Uri.file(fileName)).then((doc) => {
            window.showTextDocument(doc).then(() => {
                if (!editor) {
                    return;
                }
                editor.selection = newSelection;
                editor.revealRange(newVisibleRange, 2);
            });
        });
    }

    public onTextChange(
        contentChanges: TextDocumentContentChangeEvent[],
        document: TextDocument
    ) {
        if (!contentChanges.length) {
            return;
        }

        this.history = this.history.map((step) =>
            this.updateStepWithContentChanges(step, contentChanges)
        );

        const newText = contentChanges[0].text;

        // don't add blank changes to history
        if (!newText || !newText.replace(/[\n| ]/g, "").length) {
            return;
        }

        let linesSet = new Set();

        contentChanges.forEach(({ range, rangeLength, text }) => {
            const linesStart: number = range.start.line;
            const linesEnd = range.end.line;
            const linesText = text.split("\n");
            const numberOfLines = linesEnd - linesStart + 1;
            const numberOfNewLines = linesText.length - 1;
            const numberOfLinesDeleted = rangeLength
                ? range.end.line - range.start.line
                : 0;

            new Array(numberOfLines + numberOfNewLines - numberOfLinesDeleted)
                .fill(0)
                .forEach((_, i: number) => {
                    if (linesText[i].trim() !== "" || this.doHighlightEmptyLines) {
                        linesSet.add(linesStart + i);
                    }
                });
        });

        const lines = [...linesSet] as number[];
        const char = contentChanges.slice(-1)[0].range.end.character + 1;

        this.addChangeToHistory(document.fileName, lines, char);
        this.onHighlightChanges();
    }

    private clearDecoration = window.createTextEditorDecorationType({
        backgroundColor: "rgba(0,0,0,0.001)",
        isWholeLine: true,
    });

    public async onClearChangesWithinFile(document: TextDocument, editor: TextEditor) {
        this.history = this.history.filter(
            ([changeFileName, changeLines]: HistoryItem) => {
                const isCurrentFile = changeFileName === document.fileName;
                if (isCurrentFile) {
                    return false;
                } else {
                    return true;
                }
            }
        );
        const visibleEditorIndex = window.visibleTextEditors.findIndex(
            (visibleEditor) => visibleEditor.document.fileName === document.fileName
        );
        this.clearChanges(visibleEditorIndex);
        this.onHighlightChanges();
        this.currentHistoryIndex = 0;
    }

    public async onClearProjectChanges() {
        this.history = [];
        this.clearChanges();
        this.onHighlightChanges();
        this.currentHistoryIndex = 0;
    }

    private clearChanges(visibleEditorIndex?: number) {
        let index = 0;
        for (const fileDecorations of this.decorationTypes) {
            if (!Number.isInteger(visibleEditorIndex) || index === visibleEditorIndex) {
                for (const decoration of fileDecorations) {
                    decoration.dispose();
                }
                this.decorationTypes[index] = this.getDecorationTypes()
            }
            index++;
        }
    }

    private updateStepWithContentChanges(
        [stepFileName, lines, lastPosition]: HistoryItem,
        contentChanges: TextDocumentContentChangeEvent[]
    ): HistoryItem {
        const editor = window.activeTextEditor;
        const fileName = editor?.document.fileName;

        if (stepFileName !== fileName) {
            return [stepFileName, lines, lastPosition];
        }

        let newLines = [...lines];
        let newLastLine = lastPosition[0];

        contentChanges.forEach(({ range, rangeLength, text }) => {
            if (lines.slice(-1)[0] < lines[0]) {
                return lines;
            }
            // remove deleted lines
            // newLines = rangeLength ? newLines.filter(line => (
            //     line < range.start.line
            //     || line > range.end.line
            // )) : newLines;

            let runningLineDiff = 0;

            const numberOfNewLines = text.split("\n").length - 1;
            const numberOfLinesDeleted = rangeLength
                ? range.end.line - range.start.line
                : 0;
            runningLineDiff -= numberOfLinesDeleted;
            runningLineDiff += numberOfNewLines;

            if (newLastLine > range.start.line) {
                newLastLine += runningLineDiff;
            }

            newLines = [
                ...new Set(
                    newLines.map((line) =>
                        line <= range.start.line ? line : line + runningLineDiff
                    )
                ),
            ].sort();
        });

        const newLastPosition = [newLastLine, lastPosition[1]];
        return [fileName, newLines, newLastPosition];
    }
}
