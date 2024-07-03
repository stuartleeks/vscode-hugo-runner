// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { HugoRunnerExtension } from './hugoRunnerExtension';
import { HugoRunnerViewProvider } from './runnerViewProvider';


export function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Hugo Runner');
	const hugoRunner = new HugoRunnerExtension(context, outputChannel);

	const viewProvider = new HugoRunnerViewProvider(context, hugoRunner);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(HugoRunnerViewProvider.viewType, viewProvider));

	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.hugoInstall', () => hugoRunner.installHugo()));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.hugoVersion', () => hugoRunner.showHugoVersion()));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.showOutput', () => hugoRunner.showOutput()));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.runHugo', () => hugoRunner.startHugo()));
	context.subscriptions.push(vscode.commands.registerCommand('vscode-hugo-runner.stopHugo', () => hugoRunner.stopHugo()));

}

export function deactivate() { }
