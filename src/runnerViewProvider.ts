import * as vscode from 'vscode';
import { HugoRunnerExtension } from './hugoRunnerExtension';

export class HugoRunnerViewProvider implements vscode.WebviewViewProvider {
	private _view?: vscode.WebviewView;
	public static readonly viewType = 'vscode-hugo-runner.hugoRunner';

	constructor(private readonly context: vscode.ExtensionContext, private readonly runner: HugoRunnerExtension) {

		runner.addEventListener("hugoStarted", () => {this.sendHugoRunning();});
		runner.addEventListener("hugoStopped", () => {this.sendHugoStopped();});
	}
	resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, token: vscode.CancellationToken): void | Thenable<void> {

		this._view = webviewView;
		this._view.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'webviewReady':
					{
						if (this.runner.isHugoRunning) {
							this.sendHugoRunning();
						} else {
							this.sendHugoStopped();
						}
						break;
					}
				case 'startHugo':
					{
						const drafts = !!data.drafts;
						const future = !!data.future;
						const expired = !!data.expired;
						this.runner.startHugo({ drafts, future, expired });
						break;
					}
				case 'stopHugo':
					{
						this.runner.stopHugo();
						break;
					}
				case 'showOutput':
					{
						this.runner.showOutput();
						break;
					}
			}
		});

		webviewView.webview.postMessage({ type: 'hugoStarted' });
	}

	private sendHugoRunning() {
		if (this._view) {
			this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
			this._view.webview.postMessage({ type: 'hugoStarted' });
		}
	}
	private sendHugoStopped() {
		if (this._view) {
			this._view.show?.(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
			this._view.webview.postMessage({ type: 'hugoStopped' });
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));

		// Do the same for the stylesheet.
		const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'reset.css'));
		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'vscode.css'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css'));

		// Use a nonce to only allow a specific script to be run.
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading styles from our extension directory,
					and only allow scripts that have a specific nonce.
					(See the 'webview-sample' extension sample for img-src content security policy examples)
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>Hugo Runner</title>
			</head>
			<body>
				<div class="start-stop">
					<button class="start-button">Start Hugo</button>
					<button class="stop-button" disabled>Stop Hugo</button>
				</div>
				<div class="options">
					<h2>Options</h2>
					<div>
						<input type="checkbox" id="include-drafts" name="include-drafts">
						<label for="drafts">Include Drafts</label>
					</div>
					<div>
						<input type="checkbox" id="include-expired" name="include-expired">
						<label for="include-expired">Include Expired</label>
					</div>
					<div>
						<input type="checkbox" id="include-future" name="include-future">
						<label for="include-future">Include Future</label>
					</div>
				</div>
				<button class="show-output-button">Show Output</button>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}


function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}