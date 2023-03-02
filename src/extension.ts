// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {
	ExtensionContext,
	languages,
	commands,
	workspace,
	window,
	WorkspaceEdit,
	ConfigurationTarget,
} from "vscode";
import { FootstepsProvider } from "./FootstepsProvider";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
	const footstepsProvider = new FootstepsProvider();

	// languages.registerDocumentHighlightProvider("*", footstepsProvider);

	commands.registerCommand("footsteps.skipBack", () => {
		footstepsProvider.onTimeTravel(-1);
	});

	commands.registerCommand("footsteps.skipForwards", () => {
		footstepsProvider.onTimeTravel(1);
	});

	commands.registerCommand("footsteps.skipBackSameFile", () => {
		footstepsProvider.onTimeTravel(-1, "within-file");
	});

	commands.registerCommand("footsteps.skipForwardsSameFile", () => {
		footstepsProvider.onTimeTravel(1, "within-file");
	});

	commands.registerCommand("footsteps.skipBackDifferentFile", () => {
		footstepsProvider.onTimeTravel(-1, "across-files");
	});

	commands.registerCommand("footsteps.skipForwardsDifferentFile", () => {
		footstepsProvider.onTimeTravel(1, "across-files");
	});

	commands.registerCommand("footsteps.toggleHighlightingLines", async () => {
		const userSetting = workspace.getConfiguration("footsteps");
		const doHighlightChanges = userSetting.get("doHighlightChanges");
		const specificSetting = userSetting.inspect("doHighlightChanges");
		const doSetAsGlobal =
			specificSetting && specificSetting.workspaceValue === undefined;
		await userSetting.update(
			"doHighlightChanges",
			!doHighlightChanges,
			doSetAsGlobal
		);
	});

	commands.registerCommand("footsteps.clearChangesWithinFile", () => {
		const document = window?.activeTextEditor?.document;
		if (!document) return;
		if (!window?.activeTextEditor) return;
		footstepsProvider.onClearChangesWithinFile(document, window?.activeTextEditor);
	});

	commands.registerCommand("footsteps.clearProjectChanges", () => {
		const document = window?.activeTextEditor?.document;
		if (!document) return;
		footstepsProvider.onClearProjectChanges(document);
	});

	workspace.onDidChangeTextDocument((event) => {
		footstepsProvider.onTextChange([...event.contentChanges], event.document);
	});
}

// this method is called when your extension is deactivated
export function deactivate() { }
