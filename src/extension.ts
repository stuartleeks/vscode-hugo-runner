// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as child_process from 'child_process'
import * as path from 'path';
import { getApi, FileDownloader } from "@microsoft/vscode-file-downloader-api";


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "vscode-hugo-runner" is now active!');

	console.log(context.globalStorageUri);


	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user

		vscode.window.showInformationMessage(`Hello World from vscode-hugo-runner!`);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.hugoInstall', async () => {

		vscode.workspace.fs.createDirectory(context.globalStorageUri);

		const response = await fetch('https://github.com/gohugoio/hugo/releases/latest');
		const url = response.url;
		const segments = url.split('/');
		const lastSegment = segments[segments.length - 1];
		const latestVersion = lastSegment.slice(1);

		// TODO: handle non-windows and arm!
		const downloadUrl = `https://github.com/gohugoio/hugo/releases/download/v${latestVersion}/hugo_extended_${latestVersion}_windows-amd64.zip`

		const fileDownloader: FileDownloader = await getApi();
		const directory = await fileDownloader.downloadFile(
			vscode.Uri.parse(downloadUrl),
			"hugo",
			context,
			undefined,
			undefined,
			{ shouldUnzip: true }
		);

		const hugoPath=path.join(directory.fsPath, 'hugo.exe');
		const buf = child_process.execSync(`${hugoPath} version`);
		const output = buf.toString();
		console.log(output);


		vscode.window.showInformationMessage(`Successfully downloaded hugo (${latestVersion})`);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.hugoVersion', async () => {
		const fileDownloader: FileDownloader = await getApi();
		const hugoItem = await fileDownloader.tryGetItem("hugo", context);

		if (hugoItem === undefined) {
			vscode.window.showErrorMessage("Hugo is not installed. Please run 'Hugo Runner: Install Hugo' first.");
			return;
		}
		const hugoPath=path.join(hugoItem.fsPath, 'hugo.exe');
		const buf = child_process.execSync(`${hugoPath} version`);
		const output = buf.toString();
		console.log(output);

		vscode.window.showInformationMessage(output);
	}));

}

// This method is called when your extension is deactivated
export function deactivate() { }
