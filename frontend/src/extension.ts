import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('codegenie.generateCode', () => {
    const activeEditor = vscode.window.activeTextEditor;
    const fileName = activeEditor?.document.fileName || '';
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    const isUntitled = fileName.startsWith('Untitled');

    let detectedLanguage: string | null = null;
    switch (fileExtension) {
      case 'py': detectedLanguage = 'python'; break;
      case 'js': detectedLanguage = 'javascript'; break;
      case 'java': detectedLanguage = 'java'; break;
      case 'cpp':
      case 'cc':
      case 'cxx':
      case 'c': detectedLanguage = 'cpp'; break;
      case 'html': detectedLanguage = 'html'; break;
      default: detectedLanguage = null;
    }

    const panel = vscode.window.createWebviewPanel(
      'codeGenie',
      'CodeGenie 💡✨',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    panel.webview.html = getWebviewContent(detectedLanguage, isUntitled);

    panel.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'generateCode') {
        const promptText = message.prompt;
        const language = message.language || detectedLanguage;

        if (!language) {
          panel.webview.postMessage({ type: "codeGenerated", value: "⚠ Please select a language." });
          return;
        }

        try {
          const response = await fetch("https://e591-34-58-161-104.ngrok-free.app/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: promptText, language })
          });

          const rawText = await response.text();
          console.log("🔍 Raw backend response:", rawText);

          let code = "";
          try {
            const result = JSON.parse(rawText);
            code = result.generated_code || result.code || result.text || rawText;
          } catch {
            code = rawText;
          }

          panel.webview.postMessage({ type: "codeGenerated", value: code });

          const editor = vscode.window.activeTextEditor;
          if (editor && code.trim()) {
            editor.edit((editBuilder) => {
              editBuilder.insert(editor.selection.active, code);
            });
          }
        } catch (error) {
          panel.webview.postMessage({ type: "codeGenerated", value: "❌ Error generating code. Check backend." });
          vscode.window.showErrorMessage("CodeGenie: Backend error. Check console.");
        }
      }
    });
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(detectedLanguage: string | null, isUntitled: boolean): string {
  const prismLang = detectedLanguage || 'python';

  const languageSelector = isUntitled
    ? `<div style="padding: 10px; background:rgb(39, 57, 219); display: flex; gap: 10px; align-items: center;">
        <label for="languageSelect"><strong>Choose Language:</strong></label>
        <select id="languageSelect" style="padding: 6px; font-size: 14px;">
          <option value="">-- Select --</option>
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
          <option value="c">C</option>
          <option value="html">HTML</option>
        </select>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CodeGenie</title>
  <link href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.css" rel="stylesheet" />
  <style>
    body {
      font-family: Segoe UI, Tahoma, sans-serif;
      margin: 0;
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: rgb(205, 166, 228);
    }
    h1 {
      color: #673ab7;
      padding: 10px 20px;
      margin: 0;
      background: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    #newChatBtn {
      background: #e53935;
      color: white;
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .main-container {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    .sidebar {
      width: 200px;
      background: #120202;
      color: white;
      border-right: 1px solid #ddd;
      padding: 10px;
    }
    .sidebar li {
      padding: 6px;
      cursor: pointer;
      border-radius: 4px;
    }
    .sidebar li:hover {
      background: #333;
    }
    .chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 10px;
      overflow-y: auto;
    }
    .chat-entry {
      background: white;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 10px;
    }
    .chat-entry.user {
      border-left: 4px solid #007acc;
    }
    .chat-entry.genie {
      border-left: 4px solid #673ab7;
      background: #2d2d2d;
      color: white;
    }
    .bottom-bar {
      display: flex;
      padding: 10px;
      background: #eee;
      border-top: 1px solid #ccc;
    }
    .bottom-bar input {
      flex: 1;
      padding: 10px;
      font-size: 14px;
      background: #f0f0f0;
      border: 1px solid #ccc;
      border-radius: 4px 0 0 4px;
    }
    .bottom-bar button {
      background: #007acc;
      color: white;
      border: none;
      padding: 0 20px;
      font-size: 20px;
      border-radius: 0 4px 4px 0;
      cursor: pointer;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-${prismLang}.min.js"></script>
</head>
<body>
  <h1>
    CodeGenie 🧞‍♂✨
    <button id="newChatBtn" onclick="startNewChat()">🆕 New Chat</button>
  </h1>

  <div class="main-container">
    <div class="sidebar">
      <h3>Chats</h3>
      <ul id="chatHistoryList"></ul>
    </div>
    <div class="chat-area" id="chatContainer">
      ${languageSelector}
    </div>
  </div>

  <div class="bottom-bar">
    <input id="promptInput" type="text" placeholder="Type your prompt here..." />
    <button onclick="generateCode()">➡</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const chatContainer = document.getElementById('chatContainer');
    const chatHistoryList = document.getElementById('chatHistoryList');
    const promptInput = document.getElementById('promptInput');

    let chatCounter = 1;
    let currentChat = [];
    let allChats = {};
    let currentChatName = "Chat " + chatCounter;

    function generateCode() {
      const prompt = promptInput.value.trim();
      if (!prompt) return;

      const languageSelector = document.getElementById('languageSelect');
      const language = languageSelector ? languageSelector.value : '${detectedLanguage}';

      if (!language) {
        const responseDiv = document.createElement('div');
        responseDiv.className = 'chat-entry genie';
        responseDiv.innerHTML = '<strong>Genie:</strong><pre>⚠ Please select a language.</pre>';
        chatContainer.appendChild(responseDiv);
        return;
      }

      const userDiv = document.createElement('div');
      userDiv.className = 'chat-entry user';
      userDiv.innerHTML = '<strong>You:</strong><pre>' + prompt + '</pre>';
      chatContainer.appendChild(userDiv);

      const responseDiv = document.createElement('div');
      responseDiv.className = 'chat-entry genie';
      responseDiv.id = 'lastResponse';
      responseDiv.innerHTML = '<strong>Genie:</strong><pre>Generating...</pre>';
      chatContainer.appendChild(responseDiv);

      chatContainer.scrollTop = chatContainer.scrollHeight;
      promptInput.value = '';

      vscode.postMessage({ command: 'generateCode', prompt, language });
      currentChat.push({ prompt, response: null });
    }

    function startNewChat() {
      if (currentChat.length > 0) {
        allChats[currentChatName] = [...currentChat];
        addToSidebar(currentChatName);
        chatCounter++;
      }
      currentChatName = "Chat " + chatCounter;
      currentChat = [];
      chatContainer.innerHTML = '${languageSelector}';
    }

    function addToSidebar(name) {
      const li = document.createElement('li');
      li.textContent = name;
      li.onclick = () => loadChat(name);
      chatHistoryList.appendChild(li);
    }

    function loadChat(name) {
      currentChat = allChats[name] || [];
      currentChatName = name;
      chatContainer.innerHTML = '${languageSelector}';
      currentChat.forEach(pair => {
        const user = document.createElement('div');
        user.className = 'chat-entry user';
        user.innerHTML = '<strong>You:</strong><pre>' + pair.prompt + '</pre>';
        chatContainer.appendChild(user);

        const genie = document.createElement('div');
        genie.className = 'chat-entry genie';
        genie.innerHTML = '<strong>Genie:</strong><pre>' + pair.response + '</pre>';
        chatContainer.appendChild(genie);
      });
    }

    window.addEventListener('message', (event) => {
      const code = event.data.value || '⚠ Empty response.';
      const last = document.getElementById('lastResponse');
      if (last) {
        last.innerHTML = '<strong>Genie:</strong><pre>' + code + '</pre>';
        Prism.highlightAllUnder(last);
        last.removeAttribute('id');
      }
      if (currentChat.length > 0) {
        currentChat[currentChat.length - 1].response = code;
      }
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });
  </script>
</body>
</html>`;
}