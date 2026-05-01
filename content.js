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
      
      // Efeito visual (Pulsar) para mostrar onde o destaque está
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

  // Apply visual highlight
  const mark = document.createElement('mark');
  mark.className = `hl-${color}`;
  mark.dataset.hlId = highlightId;
  
  try {
    mark.appendChild(range.extractContents());
    range.insertNode(mark);
  } catch (e) {
    console.error("Falha ao destacar (seleção complexa):", e);
    return; // Ignore if cannot wrap simple node
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

// Restaura highlights percorrendo os nós de texto para não quebrar eventos DOM
function restoreHighlights() {
  const pageUrl = window.location.href.split('#')[0];
  chrome.storage.local.get([pageUrl], (result) => {
    const highlights = result[pageUrl];
    if (highlights && highlights.length > 0) {
      highlights.forEach(hl => {
        const parentNode = getNodeFromXPath(hl.xpath);
        if (parentNode) {
          highlightTextInNode(parentNode, hl.text, hl.color, hl.id);
        }
      });
    }
  });
}

// Lógica de injeção segura que não quebra o InnerHTML de outros elementos
function highlightTextInNode(element, text, color, id) {
  if (text.trim() === "") return false;
  
  const treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let currentNode;
  
  while (currentNode = treeWalker.nextNode()) {
    textNodes.push(currentNode);
  }

  for (let node of textNodes) {
    const index = node.nodeValue.indexOf(text);
    if (index !== -1) {
      const mark = document.createElement('mark');
      mark.className = `hl-${color}`;
      mark.dataset.hlId = id;

      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);
      
      try {
        mark.appendChild(range.extractContents());
        range.insertNode(mark);
        return true; 
      } catch (e) {
        // Silently continue se não der para inserir
      }
    }
  }
  return false;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', restoreHighlights);
} else {
  restoreHighlights();
}
