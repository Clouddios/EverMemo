// Extrair XPath de um nó
function getXPath(node) {
  if (node.id !== '') {
    return 'id("' + node.id + '")';
  }
  if (node === document.body) {
    return node.tagName.toLowerCase();
  }

  let ix = 0;
  let siblings = node.parentNode.childNodes;

  for (let i = 0; i < siblings.length; i++) {
    let sibling = siblings[i];
    if (sibling === node) {
      return getXPath(node.parentNode) + '/' + node.tagName.toLowerCase() + '[' + (ix + 1) + ']';
    }
    if (sibling.nodeType === 1 && sibling.tagName === node.tagName) {
      ix++;
    }
  }
}

// Obter nó a partir do XPath
function getNodeFromXPath(xpath) {
  try {
    const evaluator = new XPathEvaluator();
    const result = evaluator.evaluate(xpath, document.documentElement, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return result.singleNodeValue;
  } catch (e) {
    return null;
  }
}

// Escuta mensagens do background.js e popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'apply_highlight') {
    highlightSelection(request.color);
  } else if (request.action === 'scroll_to_highlight') {
    const mark = document.querySelector(`mark[data-hl-id="${request.id}"]`);
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      const originalTransition = mark.style.transition;
      mark.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
      mark.style.transform = 'scale(1.15)';
      mark.style.boxShadow = '0 0 12px rgba(0,0,0,0.5)';
      
      setTimeout(() => {
        mark.style.transform = 'scale(1)';
        mark.style.boxShadow = '';
        setTimeout(() => {
          mark.style.transition = originalTransition;
        }, 300);
      }, 700);
    }
  }
});

function highlightSelection(color) {
  const selection = window.getSelection();
  if (selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  const text = selection.toString();

  if (text.trim() === "") return;

  const container = range.commonAncestorContainer;
  const element = container.nodeType === 3 ? container.parentNode : container;
  const xpath = getXPath(element);
  const highlightId = 'hl_' + Date.now() + Math.floor(Math.random() * 1000);

  const mark = document.createElement('mark');
  mark.className = `hl-${color}`;
  mark.dataset.hlId = highlightId;
  
  try {
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
  } catch (e) {
    console.error("Falha ao destacar (seleção complexa):", e);
    // Em seleções complexas (cruzando parágrafos inteiros), é difícil injetar o HTML.
    // Ignoramos a injeção ao invés de quebrar, mas vamos tentar salvar se quiser.
    // Aqui retornamos para não salvar marcação "falsa" na interface.
    return;
  }

  selection.removeAllRanges();

  saveHighlight({
    id: highlightId,
    color: color,
    text: text,
    xpath: xpath,
    url: window.location.href.split('#')[0],
    timestamp: Date.now()
  });
}

function saveHighlight(highlightData) {
  const pageUrl = highlightData.url;
  chrome.storage.local.get([pageUrl], (result) => {
    let highlights = result[pageUrl] || [];
    highlights.push(highlightData);
    chrome.storage.local.set({ [pageUrl]: highlights });
  });
}

let unrecoveredHighlights = [];

// Restaura highlights com suporte a páginas dinâmicas (SPA como React/Vue)
function restoreHighlights() {
  const pageUrl = window.location.href.split('#')[0];
  chrome.storage.local.get([pageUrl], (result) => {
    const highlights = result[pageUrl];
    if (highlights && highlights.length > 0) {
      unrecoveredHighlights = [...highlights];
      attemptRestore();
    }
  });
}

function attemptRestore() {
  unrecoveredHighlights = unrecoveredHighlights.filter(hl => {
    // Tenta encontrar pelo XPath exato, senão busca no body inteiro (fallback)
    const parentNode = getNodeFromXPath(hl.xpath) || document.body;
    const success = highlightTextInNode(parentNode, hl.text, hl.color, hl.id);
    return !success; // Mantém no array apenas se NÃO teve sucesso
  });
}

// Observa mudanças no DOM para restaurar textos que demoram a carregar (ex: Twitter, Notion)
const observer = new MutationObserver(() => {
  if (unrecoveredHighlights.length > 0) {
    attemptRestore();
  }
});

// Encontrar indices ignorando espaçamentos ou quebras de linha complexas
function findMatchIndices(fullText, searchText) {
  let start = fullText.indexOf(searchText);
  if (start !== -1) return { start, end: start + searchText.length };

  start = fullText.toLowerCase().indexOf(searchText.toLowerCase());
  if (start !== -1) return { start, end: start + searchText.length };

  const strip = str => str.replace(/\s+/g, '');
  const strippedSearch = strip(searchText).toLowerCase();
  if (!strippedSearch) return null;

  let strippedFull = '';
  let indexMap = [];
  for (let i = 0; i < fullText.length; i++) {
    if (!/\s/.test(fullText[i])) {
      strippedFull += fullText[i].toLowerCase();
      indexMap.push(i);
    }
  }

  let strippedStart = strippedFull.indexOf(strippedSearch);
  if (strippedStart !== -1) {
    let startOrig = indexMap[strippedStart];
    let endOrig = indexMap[strippedStart + strippedSearch.length - 1] + 1;
    return { start: startOrig, end: endOrig };
  }
  return null;
}

// Lógica de injeção resiliente baseada em índices de texto real (ignora tags ocultas)
function highlightTextInNode(element, text, color, id) {
  if (text.trim() === "") return false;
  if (!element || element.nodeType !== 1) return false;
  
  // Evitar duplicidade caso o MutationObserver dispare duas vezes
  if (element.querySelector(`mark[data-hl-id="${id}"]`)) return true;

  const treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let fullText = "";
  
  let currentNode;
  while (currentNode = treeWalker.nextNode()) {
    // Ignorar scripts e styles
    if (currentNode.parentNode && (currentNode.parentNode.tagName === 'SCRIPT' || currentNode.parentNode.tagName === 'STYLE')) continue;
    textNodes.push(currentNode);
    fullText += currentNode.nodeValue;
  }

  const match = findMatchIndices(fullText, text);
  if (!match) return false;

  const startIndex = match.start;
  const endIndex = match.end;

  let startNode, startOffset, endNode, endOffset;
  let currentIndex = 0;

  for (let node of textNodes) {
    const nodeLength = node.nodeValue.length;
    if (!startNode && startIndex >= currentIndex && startIndex < currentIndex + nodeLength) {
      startNode = node;
      startOffset = startIndex - currentIndex;
    }
    if (!endNode && endIndex > currentIndex && endIndex <= currentIndex + nodeLength) {
      endNode = node;
      endOffset = endIndex - currentIndex;
    }
    currentIndex += nodeLength;
  }

  if (startNode && endNode) {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);

    const mark = document.createElement('mark');
    mark.className = `hl-${color}`;
    mark.dataset.hlId = id;

    try {
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
      return true; 
    } catch (e) {
      // Se quebrar regras de HTML cruzando elementos em bloco, usa fallback super seguro:
      try {
        const fallbackRange = document.createRange();
        fallbackRange.selectNodeContents(startNode);
        const fallbackMark = document.createElement('mark');
        fallbackMark.className = `hl-${color}`;
        fallbackMark.dataset.hlId = id;
        fallbackMark.appendChild(fallbackRange.extractContents());
        fallbackRange.insertNode(fallbackMark);
        return true;
      } catch (err) {
        return false;
      }
    }
  }
  return false;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    restoreHighlights();
    observer.observe(document.body, { childList: true, subtree: true });
  });
} else {
  restoreHighlights();
  observer.observe(document.body, { childList: true, subtree: true });
}
