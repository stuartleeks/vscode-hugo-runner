(function () {
    // See https://github.com/microsoft/vscode-extension-samples/blob/main/webview-view-sample/media/main.js
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    const startButton = document.querySelector('.start-button');
    startButton?.addEventListener('click', () => { startHugo(); });

    const stopButton = document.querySelector('.stop-button');
    stopButton?.addEventListener('click', () => { stopHugo(); });
    
    const showOutputButton = document.querySelector('.show-output-button');
    showOutputButton?.addEventListener('click', () => { showOutput(); });

    const includeDraftsCheckbox = document.getElementById('include-drafts');
    includeDraftsCheckbox?.addEventListener('change', () => { saveState(); });
    
    const includeFutureCheckbox = document.getElementById('include-future');
    includeFutureCheckbox?.addEventListener('change', () => { saveState(); });
    
    const includeExpiredCheckbox = document.getElementById('include-expired');
    includeExpiredCheckbox?.addEventListener('change', () => { saveState(); });


    const previousState = vscode.getState();
    if (previousState) {
        includeDraftsCheckbox.checked = previousState.drafts;
        includeFutureCheckbox.checked = previousState.future;
        includeExpiredCheckbox.checked = previousState.expired;
    }

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'hugoStarted':
                {
                    startButton?.setAttribute('disabled', 'disabled');
                    includeDraftsCheckbox?.setAttribute('disabled', 'disabled');
                    includeFutureCheckbox?.setAttribute('disabled', 'disabled');
                    includeExpiredCheckbox?.setAttribute('disabled', 'disabled');
                    stopButton?.attributes.removeNamedItem('disabled');
                    break;
                }
            case 'hugoStopped':
                {
                    startButton?.attributes.removeNamedItem('disabled');
                    includeDraftsCheckbox?.attributes.removeNamedItem('disabled');
                    includeFutureCheckbox?.attributes.removeNamedItem('disabled');
                    includeExpiredCheckbox?.attributes.removeNamedItem('disabled');
                    stopButton?.setAttribute('disabled', 'disabled');
                    break;
                }
        }
    });

    function startHugo() {
        const drafts = includeDraftsCheckbox?.checked;
        const future = includeFutureCheckbox?.checked;
        const expired = includeExpiredCheckbox?.checked;
        vscode.postMessage({ type: 'startHugo', drafts, future, expired});
    }
    function stopHugo() {
        vscode.postMessage({ type: 'stopHugo' });
    }
    function showOutput() {
        vscode.postMessage({ type: 'showOutput' });
    }

    function saveState(){
        const drafts = includeDraftsCheckbox?.checked;
        const future = includeFutureCheckbox?.checked;
        const expired = includeExpiredCheckbox?.checked;
        vscode.setState({drafts, future, expired});
    }
}());

