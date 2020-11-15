// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext, languages, commands } from 'vscode';
import { FootstepsProvider } from './FootstepsProvider';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
	const footstepsProvider = new FootstepsProvider();

	languages.registerDocumentHighlightProvider("*", footstepsProvider);

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

}

// this method is called when your extension is deactivated
export function deactivate() { }
