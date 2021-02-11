import { DocumentHighlightProvider, window, workspace, Position, Selection, Range, Uri, TextEditorDecorationType, Color, ExtensionContext, TextDocumentContentChangeEvent, TextDocument } from 'vscode';

import { HistoryItem, History } from "./types";
import { onHighlightLine } from "./decorator";

/**
 * FootstepsProvider
 *
 * TODO:
 * - handle newlines above changes
 * - don't save changes in non-workspace/Untitled files
 *
 */
export class FootstepsProvider {

    private history: History = [];
    private currentHistoryIndex: number = 0;
    private maxNumberOfChangesToRemember: number = 10;
    private maxNumberOfChangesToHighlight: number = 6;
    private decorationTypes: TextEditorDecorationType[] = [];
    private highlightColor: string = "rgb(255, 99, 72)";

    constructor() {
        this.onSyncWithSettings();
        this.createDecorationTypes();

        window.onDidChangeActiveTextEditor(() => {
            this.onHighlightChanges();
        });

        window.onDidChangeTextEditorSelection(() => {
            this.onHighlightChanges();
        });

        workspace.onDidChangeConfiguration((event) => {
            if (!event.affectsConfiguration('footsteps')) {
                return;
            }
            this.onSyncWithSettings();
            this.createDecorationTypes();
        });
    }

    private onSyncWithSettings(): void {
        const userSetting = workspace.getConfiguration("footsteps");
        this.maxNumberOfChangesToRemember = userSetting.maxNumberOfChangesToRemember;
        this.maxNumberOfChangesToHighlight = userSetting.maxNumberOfChangesToHighlight;
        this.highlightColor = userSetting.highlightColor;
    }

    private createDecorationTypes(): void {
        const getOpacity = (index: number) => {
            const percentAlong = index / this.maxNumberOfChangesToHighlight;
            return 0.4 * (1 - percentAlong);
        };

        this.decorationTypes = new Array(this.maxNumberOfChangesToHighlight).fill(0).map((_, i) => (
            window.createTextEditorDecorationType({
                backgroundColor: [
                    this.highlightColor.replace("rgb", "rgba").replace(/\)/g, ""),
                    ", ",
                    getOpacity(i),
                    ")",
                ].join(""),
                isWholeLine: true,
            })
        ));
    }

    public onHighlightChanges(): void {
        const editor = window.activeTextEditor;
        const fileName = editor?.document.fileName || "";

        const fileChanges = this.getChangesInFile(fileName);

        fileChanges.forEach(([_, lines], index: number) => {
            onHighlightLine(lines, this.decorationTypes[index]);
        });
    }

    private addChangeToHistory(fileName: string, lines: number[], character: number): void {
        this.currentHistoryIndex = 0;

        const overlappingChangeIndex = this.history
            .slice(0, this.maxNumberOfChangesToHighlight)
            .findIndex(([
                changeFileName,
                changeLines
            ]: HistoryItem) => (
                changeFileName === fileName
                && changeLines.find(line => (
                    lines.includes(line)
                    || lines.includes(line - 1)
                    || lines.includes(line + 1)
                ))
            ));

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
            this.history = [
                [fileName, lines, lastPosition],
                ...this.history,
            ];
        }
        this.history = this.history.slice(0, this.maxNumberOfChangesToRemember);
    }

    private getChangesInFile(fileName: string): History {
        return this.history.filter(([changeFileName]: HistoryItem) => (
            changeFileName === fileName
        ));
    }
    private getChangesInOtherFiles(fileName: string): History {
        return this.history.filter(([changeFileName]: HistoryItem) => (
            changeFileName !== fileName
        ));
    }

    public onTimeTravel(
        diff: number = 0,
        restriction: "any" | "within-file" | "across-files" = "any"
    ): void {
        const editor = window.activeTextEditor;
        const fileName = editor?.document.fileName || "";

        const changes = restriction === "any" ? this.history
            : restriction === "within-file" ? this.getChangesInFile(fileName)
                : restriction === "across-files" ? this.getChangesInOtherFiles(fileName)
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

    private onUpdateSelection(fileName: string, line: number, character: number): void {
        const editor = window.activeTextEditor;

        const newPosition = new Position(line, character);
        const newSelection = new Selection(newPosition, newPosition);

        const newVisibleRange = new Range(
            new Position(line, character),
            new Position(line, character),
        );

        workspace.openTextDocument(Uri.file(fileName)).then((doc) => {
            window.showTextDocument(doc).then(() => {
                if (!editor) { return; }
                editor.selection = newSelection;
                editor.revealRange(newVisibleRange, 2);
            });
        });
    }

    public onTextChange(
        contentChanges: TextDocumentContentChangeEvent[],
        document: TextDocument,
    ) {
        if (!contentChanges.length) {
            return;
        }

        this.history = this.history.map((step) => (
            this.updateStepWithContentChanges(step, contentChanges)
        ));

        const newText = contentChanges[0].text;

        // don't add blank changes to history
        if (!newText || !newText.replace(/[\n| ]/g, "").length) {
            return;
        }

        let linesSet = new Set();

        contentChanges.forEach(({ range, rangeLength, text }) => {
            const linesStart: number = range.start.line;
            const linesEnd = range.end.line;
            const numberOfLines = linesEnd - linesStart + 1;
            const numberOfNewLines = text.split("\n").length - 1;
            const numberOfLinesDeleted = rangeLength
                ? range.end.line - range.start.line
                : 0;

            new Array(numberOfLines + numberOfNewLines - numberOfLinesDeleted).fill(0).forEach((_, i: number) => {
                linesSet.add(linesStart + i);
            });
        });
        const lines = [...linesSet] as number[];
        const char = contentChanges.slice(-1)[0].range.end.character + 1;

        this.addChangeToHistory(document.fileName, lines, char);
        this.onHighlightChanges();
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

            newLines = [...new Set(
                newLines.map(line => (
                    line <= range.start.line
                        ? line
                        : line + runningLineDiff
                ))
            )].sort();
        });

        const newLastPosition = [newLastLine, lastPosition[1]];
        return [fileName, newLines, newLastPosition];
    }
}