document.addEventListener('DOMContentLoaded', () => {
  const colorOptions = document.querySelectorAll('.color-option');
  const highlightsList = document.getElementById('highlightsList');
  const allHighlightsList = document.getElementById('allHighlightsList');
  const tabBtns = document.querySelectorAll('.tab-btn');

  let currentPageUrl = '';

  // 1. Setup Tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
      
      if (btn.dataset.target === 'tab-all') {
        loadAllHighlights();
      }
    });
  });

  // 2. Carregar cor padrão
  function reloadDefaultColor() {
    chrome.storage.local.get(['defaultColor'], (result) => {
      const defaultColor = result.defaultColor || 'yellow';
      updateColorSelection(defaultColor);
    });
  }
  reloadDefaultColor();

  // Escuta mudanças no storage (ex: mudou a cor pelo menu de contexto) para atualizar o UI do popup se ele estiver aberto
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.defaultColor) {
      updateColorSelection(changes.defaultColor.newValue);
    }
  });

  // 3. Mudar cor padrão ao clicar na bolinha
  colorOptions.forEach(option => {
    option.addEventListener('click', () => {
      const color = option.dataset.color;
      chrome.storage.local.set({ defaultColor: color });
    });
  });

  function updateColorSelection(selectedColor) {
    colorOptions.forEach(opt => opt.classList.remove('selected'));
    const optToSelect = document.querySelector(`.color-option[data-color="${selectedColor}"]`);
    if(optToSelect) optToSelect.classList.add('selected');
  }

  // 4. Carregar destaques da aba atual
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      currentPageUrl = tabs[0].url.split('#')[0];
      loadCurrentPageHighlights();
    }
  });

  function loadCurrentPageHighlights() {
    chrome.storage.local.get([currentPageUrl], (result) => {
      const highlights = result[currentPageUrl] || [];
      renderHighlights(highlights, highlightsList, currentPageUrl, false);
    });
  }

  function loadAllHighlights() {
    chrome.storage.local.get(null, (result) => {
      allHighlightsList.innerHTML = '';
      let hasAny = false;

      // Percorre todas as chaves do storage
      for (const [key, value] of Object.entries(result)) {
        if (key === 'defaultColor') continue; // Pula as configurações
        if (Array.isArray(value) && value.length > 0) {
          hasAny = true;
          
          const groupDiv = document.createElement('div');
          groupDiv.className = 'page-group';

          const urlLink = document.createElement('a');
          urlLink.href = key;
          urlLink.target = '_blank'; // Abre em nova aba
          urlLink.className = 'page-url';
          urlLink.textContent = key;
          
          const ul = document.createElement('ul');
          ul.className = 'highlights-list';
          ul.style.maxHeight = 'none'; // Desabilita o scroll interno para agrupar

          renderHighlights(value, ul, key, true);

          groupDiv.appendChild(urlLink);
          groupDiv.appendChild(ul);
          allHighlightsList.appendChild(groupDiv);
        }
      }

      if (!hasAny) {
        allHighlightsList.innerHTML = '<div class="empty-state">Nenhum destaque salvo em outras páginas.</div>';
      }
    });
  }

  function renderHighlights(highlights, container, pageUrl, isAllPagesMode) {
    if (!isAllPagesMode) container.innerHTML = '';
    
    if (highlights.length === 0 && !isAllPagesMode) {
      container.innerHTML = '<div class="empty-state">Nenhum destaque nesta página.</div>';
      return;
    }

    highlights.forEach(hl => {
      const li = document.createElement('li');
      li.className = `highlight-item hl-${hl.color}`;
      
      const textPreview = document.createElement('span');
      textPreview.className = 'text-preview';
      textPreview.textContent = hl.text;
      textPreview.title = 'Clique para ir até a marcação na página';
      
      // Lógica de Scroll e Navegação
      textPreview.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0] && pageUrl === currentPageUrl) {
            // Se estiver na aba certa, scrollar até a marcação
            chrome.tabs.sendMessage(tabs[0].id, { action: 'scroll_to_highlight', id: hl.id }, () => {
              if (chrome.runtime.lastError) {
                // Ignorado silenciosamente
              }
            });
          } else {
            // Se não estiver na aba certa (ex: na lista de Todas), abre o site usando Text Fragments do Chrome para destacar
            window.open(`${pageUrl}#:~:text=${encodeURIComponent(hl.text)}`, '_blank');
          }
        });
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
      deleteBtn.title = 'Remover';
      deleteBtn.onclick = () => removeHighlight(hl.id, pageUrl, isAllPagesMode);

      li.appendChild(textPreview);
      li.appendChild(deleteBtn);
      container.appendChild(li);
    });
  }

  function removeHighlight(id, pageUrl, isAllPagesMode) {
    chrome.storage.local.get([pageUrl], (result) => {
      let highlights = result[pageUrl] || [];
      highlights = highlights.filter(hl => hl.id !== id);
      
      if (highlights.length === 0) {
        chrome.storage.local.remove(pageUrl, () => refreshLists());
      } else {
        chrome.storage.local.set({ [pageUrl]: highlights }, () => refreshLists());
      }
      
      function refreshLists() {
        if (isAllPagesMode) {
          loadAllHighlights();
          if (pageUrl === currentPageUrl) loadCurrentPageHighlights();
        } else {
          loadCurrentPageHighlights();
          if (document.getElementById('tab-all').classList.contains('active')) {
            loadAllHighlights();
          }
        }
      }
    });
  }

  // 5. Lógica de Backup e Exportação
  const btnExportJson = document.getElementById('btnExportJson');
  const btnExportTxt = document.getElementById('btnExportTxt');
  const btnImport = document.getElementById('btnImport');
  const fileImport = document.getElementById('fileImport');

  // Exportar JSON (Para Restauração)
  btnExportJson.addEventListener('click', () => {
    chrome.storage.local.get(null, (result) => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "evermemo_backup.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    });
  });

  // Exportar TXT (Legível para Leituras/Estudos)
  btnExportTxt.addEventListener('click', () => {
    chrome.storage.local.get(null, (result) => {
      let txtContent = "EVERMEMO - SEUS DESTAQUES\n";
      txtContent += "=================================\n\n";

      for (const [key, value] of Object.entries(result)) {
        if (key === 'defaultColor') continue;
        if (Array.isArray(value) && value.length > 0) {
          txtContent += `🔗 Página: ${key}\n`;
          txtContent += `---------------------------------\n`;
          value.forEach(hl => {
            const coresMap = {
               'yellow': 'Amarelo',
               'green': 'Verde',
               'blue': 'Azul',
               'pink': 'Rosa',
               'orange': 'Laranja',
               'purple': 'Roxo'
            };
            const cor = coresMap[hl.color] || hl.color;
            txtContent += `[${cor}] "${hl.text}"\n\n`;
          });
        }
      }

      const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(txtContent);
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "evermemo_destaques.txt");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    });
  });

  // Importar JSON
  btnImport.addEventListener('click', () => {
    fileImport.click();
  });

  fileImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        chrome.storage.local.set(importedData, () => {
          alert('Backup importado com sucesso!');
          
          if (document.getElementById('tab-all').classList.contains('active')) {
            loadAllHighlights();
          } else {
            loadCurrentPageHighlights();
          }

          if (importedData.defaultColor) {
            updateColorSelection(importedData.defaultColor);
          }
        });
      } catch (err) {
        alert('Erro ao importar o arquivo. Verifique se é um JSON válido do EverMemo.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
});
