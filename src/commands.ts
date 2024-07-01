import { getApi, FileDownloader } from "@microsoft/vscode-file-downloader-api";
import * as childProcess from "child_process";
import { get } from "http";
import * as path from "path";
import * as vscode from "vscode";

export class HugoRunnerExtension {
	private hugoProcess: childProcess.ChildProcessWithoutNullStreams | undefined;

	constructor(private context: vscode.ExtensionContext, private outputChannel: vscode.OutputChannel) {
	}

	async installHugo() {
		this.outputChannel.show(true);

		// TODO - temp limit to Windows

		const hugoRunnerConfig = vscode.workspace.getConfiguration('hugo-runner');
		const configHugoPath = hugoRunnerConfig.get("hugoExecutablePath");

		if (configHugoPath) {
			this.outputChannel.appendLine(`Custom path is set: ${configHugoPath}. Asking user if ok to clear`);
			const result = await vscode.window.showQuickPick(['Yes', 'No'], { placeHolder: `You have a custom path set: ${configHugoPath}. Continuing will clear that setting. Do you want continue?` });
			this.outputChannel.appendLine(`User chose: ${result}`);
			if (result !== 'Yes') {
				this.outputChannel.appendLine('User chose not to continue. Aborting.');
				return;
			}
			hugoRunnerConfig.update("hugoExecutablePath", ""); // Set to empty string to override global setting in workspace
		}

		this.outputChannel.appendLine('Ensuring local folder exists...');
		vscode.workspace.fs.createDirectory(this.context.globalStorageUri);

		this.outputChannel.appendLine('Determining latest version...');
		const response = await fetch('https://github.com/gohugoio/hugo/releases/latest');
		const url = response.url;
		const segments = url.split('/');
		const lastSegment = segments[segments.length - 1];
		const latestVersion = lastSegment.slice(1);

		// TODO: handle non-windows and arm!
		this.outputChannel.appendLine(`Downloading version ${latestVersion}...`);

		const downloadUrl = `https://github.com/gohugoio/hugo/releases/download/v${latestVersion}/hugo_extended_${latestVersion}_windows-amd64.zip`;


		const fileDownloader: FileDownloader = await getApi();
		const directory = await fileDownloader.downloadFile(
			vscode.Uri.parse(downloadUrl),
			"hugo",
			this.context,
			undefined,
			undefined,
			{ shouldUnzip: true }
		);

		this.outputChannel.appendLine('Checking that we can run hugo...');
		const hugoPath = path.join(directory.fsPath, 'hugo.exe');
		const buf = childProcess.execSync(`${hugoPath} version`);
		const output = buf.toString();
		console.log(output);

		this.outputChannel.appendLine('Hugo installed!');

		vscode.window.showInformationMessage(`Successfully downloaded hugo (${latestVersion})`);
	}
	async showHugoVersion() {
		this.outputChannel.show(true);

		const hugoPath = await this.getHugoBinaryPath();
		this.outputChannel.appendLine(`Hugo path: ${hugoPath}`);
		const buf = childProcess.execSync(`${hugoPath} version`);
		const output = buf.toString();
		this.outputChannel.appendLine(`Hugo version: ${output}`);

		vscode.window.showInformationMessage(output);
	};

	showOutput() {
		this.outputChannel.show();
	}

	private async getHugoBinaryPath(): Promise<string> {
		// Check if the user has set a custom path
		const hugoPath = vscode.workspace.getConfiguration('hugo-runner').get("hugoExecutablePath") as string;
		if (hugoPath && hugoPath.length > 0) {
			// TODO check if the path exists
			return hugoPath;
		}

		const fileDownloader: FileDownloader = await getApi();
		const hugoItem = await fileDownloader.tryGetItem("hugo", this.context);
		if (hugoItem === undefined) {
			throw new Error("Hugo is not configured/installed. Please set hugo-runner.hugoExecutablePath or run 'Hugo Runner: Install Hugo'.");
		}

		return path.join(hugoItem.fsPath, 'hugo.exe');
	}

	async runHugoCommand() {
		const options = this.getDefaultHugoOptions();
		await this.runHugo(options);
	}

	private getDefaultHugoOptions() {
		const hugoConfig = vscode.workspace.getConfiguration('hugo-runner');
		const drafts = hugoConfig.get("showDrafts") as boolean;
		const port = hugoConfig.get("port") as number;
		return { drafts, port };
	}
	private async runHugo(options? : {drafts?: boolean, port?: number}): Promise<void> {

		if (this.hugoProcess) {
			this.outputChannel.appendLine("Hugo is already running!");
			vscode.window.showErrorMessage("Hugo is already running!");
			return;
		}

		const hugoExePath = await this.getHugoBinaryPath();
		const outputChannel = this.outputChannel;

		outputChannel.show(true);
		
		const sitePath = vscode.workspace.getConfiguration('hugo-runner').get("siteFolder") as string ?? "";

		const workspaceFolderBase = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		if (!workspaceFolderBase) {
			outputChannel.appendLine("No workspace folder found!");
			throw new Error("No workspace folder found");
		}

		const fullSitePath = path.join(workspaceFolderBase, sitePath);
		console.log({ sitePath, fullSitePath });

		outputChannel.appendLine(`\nRunning Hugo in ${fullSitePath}\n`);
		const args = ["serve"];
		if (options?.drafts) {
			args.push("--buildDrafts");
		}
		if (options?.port) {
			args.push("--port", options.port.toString());
		}
		const proc = childProcess.spawn(hugoExePath, args, { cwd: fullSitePath });
		this.hugoProcess = proc;

		proc.on('error', (err) => {
			outputChannel.appendLine(`Error: ${err}`);
		});
		proc.stderr.on('data', (data) => {
			outputChannel.appendLine(`stderr: ${data}`);
		});
		proc.stdout.on('data', (data) => {
			outputChannel.appendLine(`stdout: ${data}`);
		});
		const self = this;
		proc.on('exit', () => {
			outputChannel.appendLine(`Hugo exited: ${proc.exitCode}`);
			self.hugoProcess = undefined;
		});
	}

	async stopHugo() {
		if (this.hugoProcess) {
			this.hugoProcess.kill();
		}
	}
}