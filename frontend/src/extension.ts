import * as vscode from 'vscode';
import axios from 'axios';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('codegenie.generateCode', () => {
    const panel = vscode.window.createWebviewPanel(
      'codeGenie',
      'CodeGenie 💡✨',
      vscode.ViewColumn.One,
      {
        enableScripts: true
      }
    );

    panel.webview.html = getWebviewContent();

    panel.webview.onDidReceiveMessage(async message => {
      if (message.command === 'generateCode') {
        try {
          let response;
          if (message.mode === 'fim') {
            // FIM mode request
            response = await axios.post("https://98ee-34-125-173-17.ngrok-free.app/generate", {
              mode: 'fim',
              prefix: message.prefix,
              suffix: message.suffix
            });
          } else {
            // Normal mode request
            response = await axios.post("https://98ee-34-125-173-17.ngrok-free.app/generate", {
              prompt: message.prompt
            });
          }

          const result: {
            generated_code?: string;
            code?: string;
            [key: string]: any;
          } = response.data;

          console.log("Backend response:", result);

          panel.webview.postMessage({
            type: 'codeGenerated',
            value: result.generated_code || result.code || JSON.stringify(result)
          });

          const editor = vscode.window.activeTextEditor;
          if (editor && result.generated_code) {
            editor.edit(editBuilder => {
              editBuilder.insert(editor.selection.active, result.generated_code!);
            });
          }

        } catch (error) {
          console.error("Error generating code:", error);
          panel.webview.postMessage({
            type: 'codeGenerated',
            value: 'Error generating code. Please check backend or prompt.'
          });
        }
      }
    });
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(): string {
return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>CodeGenie</title>

      <link href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.css" rel="stylesheet" />
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background-color: #f5f5f5; }
        h1 { color: #673ab7; }
        textarea { width: 100%; font-family: monospace; padding: 10px; margin-bottom: 10px; }
        button { padding: 10px 20px; background-color: #007acc; color: white; border: none; cursor: pointer; border-radius: 4px; margin-right: 8px; }
        pre { background-color: #2d2d2d; padding: 10px; border-radius: 4px; overflow-x: auto; max-height: 400px; }
        #copyButton { background-color: #4caf50; }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
    </head>
    <body>
      <h1>CodeGenie 🧞‍♂✨</h1>

      <label><input type="checkbox" id="fimModeToggle"> Enable Fill-In-The-Middle (FIM)</label><br><br>

      <div id="normalPromptSection">
        <textarea id="promptInput" rows="4" placeholder="Enter your normal prompt here..."></textarea><br />
      </div>

      <div id="fimPromptSection" style="display:none;">
        <textarea id="prefixInput" rows="4" placeholder="Enter prefix (before missing part)..."></textarea><br />
        <textarea id="suffixInput" rows="4" placeholder="Enter suffix (after missing part)..."></textarea><br />
      </div>

      <button onclick="generateCode()">Generate Code</button>
      <button id="copyButton" onclick="copyCode()">Copy Code</button>

      <pre><code id="output" class="language-none">No code generated</code></pre>

      <script>
        const vscode = acquireVsCodeApi();

        document.getElementById('fimModeToggle').addEventListener('change', function() {
          const isChecked = this.checked;
          document.getElementById('normalPromptSection').style.display = isChecked ? 'none' : 'block';
          document.getElementById('fimPromptSection').style.display = isChecked ? 'block' : 'none';
        });

        function generateCode() {
          const fimMode = document.getElementById('fimModeToggle').checked;
          const codeBlock = document.getElementById('output');
          codeBlock.textContent = 'Generating code...';
          codeBlock.className = 'language-none';
          Prism.highlightElement(codeBlock);

          if (fimMode) {
            const prefix = document.getElementById('prefixInput').value;
            const suffix = document.getElementById('suffixInput').value;

            vscode.postMessage({
              command: 'generateCode',
              mode: 'fim',
              prefix: prefix,
              suffix: suffix
            });
          } else {
            const prompt = document.getElementById('promptInput').value;

            vscode.postMessage({
              command: 'generateCode',
              prompt: prompt
            });
          }
        }

        function copyCode() {
          const codeBlock = document.getElementById('output');
          const textToCopy = codeBlock.textContent;

          navigator.clipboard.writeText(textToCopy).then(() => {
            const btn = document.getElementById('copyButton');
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
              btn.textContent = originalText;
            }, 1500);
          }).catch((err) => {
            console.error('Failed to copy: ', err);
          });
        }

        window.addEventListener('message', (event) => {
          const message = event.data;
          if (message.type === 'codeGenerated') {
            const codeBlock = document.getElementById('output');
            codeBlock.textContent = message.value;
            codeBlock.className = 'language-none';
            Prism.highlightElement(codeBlock);
          }
        });
      </script>
    </body>
    </html>`
  ;
}
