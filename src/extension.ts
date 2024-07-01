// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { HugoRunnerExtension } from './commands';


export function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Hugo Runner');
	const hugoRunner = new HugoRunnerExtension(context, outputChannel);

	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.hugoInstall', () => hugoRunner.installHugo()));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.hugoVersion', () => hugoRunner.showHugoVersion()));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.showOutput', () => hugoRunner.showOutput()));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.runHugo', () => hugoRunner.runHugoCommand()));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.stopHugo', () => hugoRunner.stopHugo()));

}

export function deactivate() { }
