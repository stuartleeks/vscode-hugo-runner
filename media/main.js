//@ts-check

// See https://github.com/microsoft/vscode-extension-samples/blob/main/webview-view-sample/media/main.js

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    const startButton = document.querySelector('.start-button');
    startButton?.addEventListener('click', () => {
        startHugo();
    });
    const stopButton = document.querySelector('.stop-button');
    stopButton?.addEventListener('click', () => {
        stopHugo();
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            case 'hugoStarted':
                {
                    startButton?.setAttribute('disabled', 'disabled');
                    stopButton?.attributes.removeNamedItem('disabled');
                    break;
                }
            case 'hugoStopped':
                {
                    startButton?.attributes.removeNamedItem('disabled');
                    stopButton?.setAttribute('disabled', 'disabled');
                    break;
                }
        }
    });

    // /**
    //  * @param {Array<{ value: string }>} colors
    //  */
    // function updateColorList(colors) {
    //     const ul = document.querySelector('.color-list');
    //     if (!ul) {
    //         return;
    //     }
    //     ul.textContent = '';
    //     for (const color of colors) {
    //         const li = document.createElement('li');
    //         li.className = 'color-entry';

    //         const colorPreview = document.createElement('div');
    //         colorPreview.className = 'color-preview';
    //         colorPreview.style.backgroundColor = `#${color.value}`;
    //         colorPreview.addEventListener('click', () => {
    //             onColorClicked(color.value);
    //         });
    //         li.appendChild(colorPreview);

    //         const input = document.createElement('input');
    //         input.className = 'color-input';
    //         input.type = 'text';
    //         input.value = color.value;
    //         input.addEventListener('change', (e) => {
    //             // @ts-ignore
    //             const value = e.target.value;
    //             if (!value) {
    //                 // Treat empty value as delete
    //                 colors.splice(colors.indexOf(color), 1);
    //             } else {
    //                 color.value = value;
    //             }
    //             updateColorList(colors);
    //         });
    //         li.appendChild(input);

    //         ul.appendChild(li);
    //     }

    //     // Update the saved state
    //     vscode.setState({ colors: colors });
    // }


    function startHugo() {
        vscode.postMessage({ type: 'startHugo' });
    }
    function stopHugo() {
        vscode.postMessage({ type: 'stopHugo' });
    }
}());

