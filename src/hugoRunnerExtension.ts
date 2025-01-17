import { getApi, FileDownloader } from "@microsoft/vscode-file-downloader-api";
import * as childProcess from "child_process";
import { get } from "http";
import * as path from "path";
import * as vscode from "vscode";

export class HugoRunnerExtension extends EventTarget {
	private hugoProcess: childProcess.ChildProcessWithoutNullStreams | undefined;

	private _hugoStarted: Event = new Event('hugoStarted');
	private _hugoStopped: Event = new Event('hugoStopped');

	private _version: string;

	constructor(private context: vscode.ExtensionContext, private outputChannel: vscode.OutputChannel) {
		super();

		this._version = context.extension.packageJSON.version;
	}

	private getHugoPlatformString(): string {
		switch (process.platform) {
			case "win32":
				return "windows";
			case "darwin":
				return "darwin";
			case "linux":
				return "linux";
			default:
				throw new Error(`Unhandled platform: ${process.platform}`);
		}
	}

	async installHugo() {
		this.outputChannel.show(true);

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

		// TODO: handle non-amd64 processor!
		const platform = this.getHugoPlatformString();
		const extension = platform === 'windows' ? 'zip' : 'tar.gz';
		const downloadUrl = `https://github.com/gohugoio/hugo/releases/download/v${latestVersion}/hugo_extended_${latestVersion}_${platform}-amd64.${extension}`;
		const filename = platform === 'windows' ? 'hugo' : 'hugo.tar.gz'; // folder name for windows, tar.gz for others

		this.outputChannel.appendLine(`Downloading version ${latestVersion}... (from ${downloadUrl})`);

		const fileDownloader: FileDownloader = await getApi();
		const directory = await fileDownloader.downloadFile(
			vscode.Uri.parse(downloadUrl),
			filename,
			this.context,
			undefined,
			undefined,
			{ shouldUnzip: platform === 'windows' }
		);

		// file downloader auto-unzips on windows
		// on other platforms, extract from tar.gz
		if (platform !== 'windows') {
			const tarPath = path.join(directory.fsPath);
			const outputPath = path.join(directory.fsPath, '../hugo');
			childProcess.execSync(`rm -rf "${outputPath}" && mkdir -p "${outputPath}" && tar -xzf "${tarPath}" -C "${outputPath}"`);
		}

		this.outputChannel.appendLine('Checking that we can run hugo...');
		const hugoPath = await this.getHugoBinaryPath();
		const buf = childProcess.execSync(`${hugoPath} version`);
		const output = buf.toString();

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

	private async getHugoBinaryPath(options ?: {allowInstallation?: boolean}): Promise<string> {
		// Check if the user has set a custom path
		const hugoPath = vscode.workspace.getConfiguration('hugo-runner').get("hugoExecutablePath") as string;
		if (hugoPath && hugoPath.length > 0) {
			// TODO check if the path exists
			return hugoPath;
		}

		const fileDownloader: FileDownloader = await getApi();
		const hugoItem = await fileDownloader.tryGetItem("hugo", this.context);
		if (hugoItem === undefined) {
			if (options?.allowInstallation) {
				const result = await vscode.window.showQuickPick(['Yes', 'No'], { placeHolder: `Couldn't find Hugo - do you want to install it?` });
				if (result === 'Yes') {
					await this.installHugo();
					return this.getHugoBinaryPath();
				}
				else {
					throw new Error("Hugo is not configured/installed (2). Please set hugo-runner.hugoExecutablePath or run 'Hugo Runner: Install Hugo'.");
				}
			}
			else {
				throw new Error("Hugo is not configured/installed. Please set hugo-runner.hugoExecutablePath or run 'Hugo Runner: Install Hugo'.");
			}
		}

		const exeName = process.platform === 'win32' ? 'hugo.exe' : 'hugo';

		return path.join(hugoItem.fsPath, exeName);
	}

	getDefaultHugoOptions() {
		const hugoConfig = vscode.workspace.getConfiguration('hugo-runner');
		const port = hugoConfig.get("port") as number;
		return { port };
	}
	get isHugoRunning() {
		return this.hugoProcess !== undefined;
	}
	async startHugo(options?: { port?: number, drafts?: boolean, future?: boolean, expired?: boolean }): Promise<void> {

		const optionsWithDefaults = { ...this.getDefaultHugoOptions(), ...options };
		const outputChannel = this.outputChannel;

		if (this.isHugoRunning) {
			outputChannel.appendLine("Hugo is already running!");
			vscode.window.showErrorMessage("Hugo is already running!");
			return;
		}

		outputChannel.clear();
		outputChannel.show(true);
		outputChannel.appendLine(`Hugo Runner v${this._version}`);

		let hugoExePath: string;
		try {
			hugoExePath = await this.getHugoBinaryPath({allowInstallation: true});
		} catch (error) {
			outputChannel.appendLine(`Error: ${error}`);
			return;
		}

		const sitePath = vscode.workspace.getConfiguration('hugo-runner').get("siteFolder") as string ?? "";

		const workspaceFolderBase = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		if (!workspaceFolderBase) {
			outputChannel.appendLine("No workspace folder found!");
			throw new Error("No workspace folder found");
		}

		const fullSitePath = path.join(workspaceFolderBase, sitePath);
		console.log({ sitePath, fullSitePath });

		outputChannel.appendLine(`\nRunning Hugo in ${fullSitePath}`);
		const args = ["serve"];
		if (optionsWithDefaults?.drafts) {
			outputChannel.appendLine("Building drafts");
			args.push("--buildDrafts");
		}
		if (optionsWithDefaults?.future) {
			outputChannel.appendLine("Building future posts");
			args.push("--buildFuture");
		}
		if (optionsWithDefaults?.expired) {
			outputChannel.appendLine("Building expired posts");
			args.push("--buildExpired");
		}
		if (optionsWithDefaults?.port) {
			outputChannel.appendLine(`Using port ${optionsWithDefaults.port}`);
			args.push("--port", optionsWithDefaults.port.toString());
		}
		outputChannel.appendLine("\n");
		const proc = childProcess.spawn(hugoExePath, args, { cwd: fullSitePath });
		this.hugoProcess = proc;

		this.dispatchEvent(this._hugoStarted);

		proc.on('error', (err) => {
			outputChannel.appendLine(`Error: ${err}`);
			self.hugoProcess = undefined;
			this.dispatchEvent(this._hugoStopped);
		});
		proc.stderr.on('data', (data) => {
			// TODO - is there a way to add colour to the output?
			outputChannel.appendLine(`${data}`);
		});
		proc.stdout.on('data', (data) => {
			outputChannel.appendLine(`${data}`);
		});
		const self = this;
		proc.on('exit', () => {
			outputChannel.appendLine(`Hugo exited: ${proc.exitCode}`);
			self.hugoProcess = undefined;
			this.dispatchEvent(this._hugoStopped);
		});
	}

	async stopHugo() {
		if (this.hugoProcess) {
			this.hugoProcess.kill();
		}
	}
}