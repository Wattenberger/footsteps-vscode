import { DocumentHighlightProvider, window, workspace, Position, Selection, Range, Uri, TextEditorDecorationType, Color } from 'vscode';
import { scaleLinear } from 'd3-scale';

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
export class FootstepsProvider implements DocumentHighlightProvider {

    private history: History = [];
    private currentHistoryIndex: number = 0;
    private maxNumberOfChangesToRemember: number = 10;
    private maxNumberOfChangesToHighlight: number = 6;
    private decorationTypes: TextEditorDecorationType[] = [];
    private highlightColor: string = "rgb(255, 99, 72)";

    constructor() {
        this.onSyncWithSettings();
        this.createDecorationTypes();

        window.onDidChangeActiveTextEditor((event) => {
            this.onHighlightChanges();
        });

        window.onDidChangeTextEditorSelection(event => {
            this.onHighlightChanges();
        });

        workspace.onDidChangeTextDocument((event) => {
            const newText = event.contentChanges[0].text;
            const fileName = event.document.fileName;

            // don't count newlines or deletions
            if (!newText || !newText.replace(/[\n| ]/g, "").length) {
                if (newText.includes("\n")) {
                    this.incrementFollowingChanges(fileName, event.contentChanges[0].range.end.line);
                }
                return;
            }

            // let's grab the first line of the change
            const line = event.contentChanges[0].range.end.line;
            const char = event.contentChanges[0].range.end.character + 1;

            this.addChangeToHistory(fileName, line, char);
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
        const opacityScale = scaleLinear()
            .domain([0, this.maxNumberOfChangesToHighlight])
            .range([0.6, 0])
            .clamp(true);

        this.decorationTypes = new Array(this.maxNumberOfChangesToHighlight).fill(0).map((_, i) => (
            window.createTextEditorDecorationType({
                backgroundColor: [
                    this.highlightColor.replace("rgb", "rgba").replace(/\)/g, ""),
                    ", ",
                    opacityScale(i),
                    ")",
                ].join(""),
                isWholeLine: true,
            })
        ));
    }

    private incrementFollowingChanges(fileName: string, lineNumber: number, diff?: number = 1): void {
        this.history = this.history.map(historyItem => {
            if (historyItem[0] !== fileName) {
                return historyItem;
            }
            if (historyItem[1].start.line <= lineNumber) {
                return historyItem;
            }
            const range = historyItem[1];
            return [
                fileName,
                new Range(
                    new Position(range.start.line + 1, range.start.character),
                    new Position(range.end.line + 1, range.end.character),
                ),
            ];
        });
    }

    public onHighlightChanges(): void {
        const editor = window.activeTextEditor;
        const fileName = editor.document.fileName;

        const fileChanges = this.getChangesInFile(fileName);

        fileChanges.forEach(([_, range], index: number) => {
            onHighlightLine(range, this.decorationTypes[index]);
        });
    }

    private addChangeToHistory(fileName: string, lineNumber: number, characterNumber: number): void {
        this.currentHistoryIndex = 0;

        const overlappingChangeIndex = this.history.findIndex(([changeFileName, changeRange]: HistoryItem) => (
            changeFileName === fileName
            && changeRange.start.line - 1 <= lineNumber
            && changeRange.end.line + 1 >= lineNumber
        ));

        if (overlappingChangeIndex !== -1) {
            const oldRange = this.history[overlappingChangeIndex][1];
            const start = oldRange.start.line < lineNumber ? oldRange.start : new Position(lineNumber, 0);
            const end = oldRange.end.line === lineNumber ? new Position(lineNumber, Math.max(characterNumber, oldRange.end.character))
                : oldRange.end.line < lineNumber ? new Position(lineNumber, characterNumber)
                    : oldRange.end;
            const newRange = new Range(start, end);
            this.history = [
                [fileName, newRange],
                ...this.history.slice(0, overlappingChangeIndex),
                ...this.history.slice(overlappingChangeIndex + 1),
            ];
        } else {
            const newPosition = new Position(lineNumber, characterNumber);
            const newRange = new Range(newPosition, newPosition);
            this.history = [
                [fileName, newRange],
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
        restriction?: "any" | "within-file" | "across-files" = "any"
    ): void {
        const editor = window.activeTextEditor;
        const fileName = editor.document.fileName

        const changes = restriction === "any" ? this.history
            : restriction === "within-file" ? this.getChangesInFile(fileName)
                : restriction === "across-files" ? this.getChangesInOtherFiles(fileName)
                    : [];

        let newHistoryIndex = this.currentHistoryIndex - diff;
        newHistoryIndex = Math.max(0, newHistoryIndex);
        newHistoryIndex = Math.min(newHistoryIndex, changes.length - 1);
        const [newFileName, newRange] = changes[newHistoryIndex];

        if (!newRange) {
            return;
        }

        this.currentHistoryIndex = newHistoryIndex;

        const newSelectionLine = newRange.end.line;
        const newSelectionChar = newRange.end.character + 1;

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
                editor.selection = newSelection;
                editor.revealRange(newVisibleRange, 2);
            });
        });
    }

}