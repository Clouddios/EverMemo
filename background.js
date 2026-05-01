// Criação do Menu de Contexto
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'highlight_parent',
    title: 'Destacar Texto',
    contexts: ['selection']
  });

  const colors = [
    { id: 'yellow', title: 'Amarelo' },
    { id: 'green', title: 'Verde' },
    { id: 'blue', title: 'Azul' }
  ];

  colors.forEach(color => {
    chrome.contextMenus.create({
      id: `highlight_${color.id}`,
      parentId: 'highlight_parent',
      title: color.title,
      contexts: ['selection']
    });
  });

  // Configurar cor padrão inicial, se não houver
  chrome.storage.local.get(['defaultColor'], (result) => {
    if (!result.defaultColor) {
      chrome.storage.local.set({ defaultColor: 'yellow' });
    }
  });
});

// Listener de cliques no Menu de Contexto
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith('highlight_')) {
    const color = info.menuItemId.split('_')[1];
    chrome.tabs.sendMessage(tab.id, {
      action: 'apply_highlight',
      color: color
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn("Aba não suportada para destaque (ex: página do sistema ou configurações).");
      }
    });
  }
});

// Listener de Atalhos de Teclado
chrome.commands.onCommand.addListener((command) => {
  if (command === 'highlight_text') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.storage.local.get(['defaultColor'], (result) => {
          const color = result.defaultColor || 'yellow';
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'apply_highlight',
            color: color
          }, () => {
            if (chrome.runtime.lastError) {
              console.warn("Aba não suportada para destaque (ex: página do sistema ou configurações).");
            }
          });
        });
      }
    });
  }
});
