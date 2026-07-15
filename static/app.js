const API = '';
let sessionId = 'session-' + Date.now();
let isLoading = false;

const chatArea = document.getElementById('chatArea');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const papersList = document.getElementById('papersList');
const paperCount = document.getElementById('paperCount');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const uploadText = document.getElementById('uploadText');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuBtn = document.getElementById('menuBtn');
const suggestionsEl = document.getElementById('suggestions');

menuBtn.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
});
overlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
});

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.name.toLowerCase().endsWith('.pdf')) uploadFile(file);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) uploadFile(e.target.files[0]); });

async function uploadFile(file) {
  uploadText.textContent = 'Uploading & indexing...';
  uploadZone.style.pointerEvents = 'none';
  uploadZone.style.opacity = '0.6';
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch(`${API}/api/upload`, { method: 'POST', body: form });
    const data = await res.json();
    if (res.ok) {
      addMessage('assistant', `**"${file.name}"** uploaded and indexed! Ask me anything about it.`);
      fetchPapers();
    } else {
      addMessage('assistant', `Upload failed: ${data.detail || 'Unknown error'}`);
    }
  } catch (err) {
    addMessage('assistant', `Upload failed: ${err.message}. Is the backend running?`);
  } finally {
    uploadText.textContent = 'Drag & drop a PDF';
    uploadZone.style.pointerEvents = '';
    uploadZone.style.opacity = '';
    fileInput.value = '';
  }
}

async function fetchPapers() {
  try {
    const res = await fetch(`${API}/api/papers`);
    const data = await res.json();
    renderPapers(data.papers);
  } catch { renderPapers([]); }
}

function renderPapers(papers) {
  paperCount.textContent = papers.length;
  if (papers.length === 0) {
    papersList.innerHTML = '<div class="empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>No papers uploaded yet</p></div>';
    return;
  }
  papersList.innerHTML = papers.map(p => `
    <div class="paper-item">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="name" title="${p}">${p}</span>
      <button class="delete-btn" onclick="deletePaper('${p.replace(/'/g, "\\'")}')" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  `).join('');
}

async function deletePaper(filename) {
  try {
    await fetch(`${API}/api/papers/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    addMessage('assistant', `**"${filename}"** deleted.`);
    fetchPapers();
  } catch {
    addMessage('assistant', `Failed to delete **"${filename}"**.`);
  }
}

function addMessage(role, content, sources) {
  if (suggestionsEl) suggestionsEl.remove();
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const avatarSvg = role === 'assistant'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  let sourcesHtml = '';
  if (sources && sources.length > 0) {
    sourcesHtml = '<div class="sources">' + sources.map(s => `<span class="source-tag">${s}</span>`).join('') + '</div>';
  }

  div.innerHTML = `
    <div class="avatar">${avatarSvg}</div>
    <div class="bubble">${marked.parse(content)}${sourcesHtml}</div>
  `;
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
  return div;
}

function createStreamingMessage() {
  if (suggestionsEl) suggestionsEl.remove();
  const div = document.createElement('div');
  div.className = 'message assistant';
  div.innerHTML = `
    <div class="avatar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg></div>
    <div class="bubble"><span class="streaming-text"></span><span class="cursor-blink">|</span></div>
  `;
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
  return div;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isLoading) return;
  isLoading = true;
  sendBtn.disabled = true;
  chatInput.value = '';
  chatInput.style.height = 'auto';
  addMessage('user', text);

  const msgDiv = createStreamingMessage();
  const streamEl = msgDiv.querySelector('.streaming-text');
  const cursorEl = msgDiv.querySelector('.cursor-blink');
  let fullText = '';

  try {
    const res = await fetch(`${API}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: text, session_id: sessionId }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sources = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.token) {
            fullText += data.token;
            streamEl.innerHTML = marked.parse(fullText);
            chatArea.scrollTop = chatArea.scrollHeight;
          }
          if (data.done) {
            sources = data.sources || [];
          }
        } catch {}
      }
    }

    cursorEl.remove();
    let sourcesHtml = '';
    if (sources.length > 0) {
      sourcesHtml = '<div class="sources">' + sources.map(s => `<span class="source-tag">${s}</span>`).join('') + '</div>';
    }
    streamEl.parentNode.innerHTML = marked.parse(fullText) + sourcesHtml;

  } catch (err) {
    cursorEl.remove();
    streamEl.innerHTML = marked.parse('Failed to get answer. Make sure the backend is running.');
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

function sendSuggestion(btn) {
  chatInput.value = btn.textContent;
  sendMessage();
}

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

fetchPapers();
