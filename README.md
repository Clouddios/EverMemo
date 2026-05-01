# 🖍️ EverMemo

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)
![Vanilla JS](https://img.shields.io/badge/Javascript-Vanilla-yellow)

O **EverMemo** é uma extensão inteligente focada em produtividade para o Google Chrome. Ele permite destacar (dar *highlight*) em qualquer texto na web usando diversas cores. Ao contrário de um marca-texto comum que se perde quando você fecha a janela, o EverMemo salva seus destaques **permanentemente** usando a API de storage do Chrome, restaurando-os magicamente nos mesmos lugares quando você volta na página!

## 🌟 Principais Funcionalidades

- 🎨 **Múltiplas Cores Vibrantes**: Destaque informações importantes usando cores neon de Amarelo, Verde ou Azul para organizar melhor os seus tópicos e prioridades.
- 💾 **Persistência Inteligente (XPath)**: Suas marcações nunca se perdem. Usamos lógica de serialização de DOM avançada para restaurar os destaques sem quebrar os eventos (`Event Listeners`) originais da página.
- ⌨️ **Atalhos Produtivos**: Pressione `Ctrl+Shift+H` (ou `Cmd+Shift+H` no Mac) para marcar instantaneamente o texto selecionado na sua cor favorita.
- 🖱️ **Navegação com 1-Clique**: Perdeu onde estava uma marcação longa? Abra a extensão e clique no texto salvo. A página rolará automaticamente (Smooth Scroll) e o texto piscará na tela.
- 📂 **Painel de Gestão Global**: Veja o que você destacou no "site atual" ou mude para a aba "Todas as Páginas" e navegue por tudo o que você já marcou na internet.
- 📦 **Backup e Resumos de Leitura**:
  - Exporte em formato **JSON** para salvar seus backups e importar em outro computador.
  - Exporte em formato **TXT** limpo e legível para colar direto no Notion, Obsidian, Word ou Evernote como notas de leitura.

## 🛠️ Como Instalar e Testar Localmente

O projeto está configurado para fácil instalação no modo desenvolvedor do Google Chrome.

1. Clone ou baixe este repositório para o seu computador:
   ```bash
   git clone https://github.com/SEU-USUARIO/EverMemo.git
   ```
2. Abra o Google Chrome e digite o seguinte endereço na barra de navegação: `chrome://extensions/`.
3. No canto superior direito da tela, ative a chave **"Modo do desenvolvedor"**.
4. Clique no botão **"Carregar sem compactação"** (Load unpacked) que aparecerá no topo à esquerda.
5. Selecione a pasta clonada do EverMemo. Pronto! A extensão já está rodando. 🎉

## 🚀 Como Usar

1. **Destacar via Menu:** Selecione qualquer texto em um site (artigos, notícias, blogs), clique com o botão direito do mouse e vá em `Destacar Texto > [Escolha a cor]`.
2. **Definir Cor Padrão:** Clique no ícone do EverMemo (no canto superior direito do navegador) para abrir o painel. Escolha sua cor de atalho clicando na bolinha correspondente (Amarelo, Verde ou Azul).
3. **Atalho Rápido:** Selecione outro texto e simplesmente pressione `Ctrl+Shift+H`.
4. **Explorar Backups:** Acesse o painel da extensão novamente para ver sua lista, clicar nos textos e brincar com as exportações no rodapé.

## ⚙️ Arquitetura e Tecnologias

O projeto foi construído usando tecnologias Web base (Vanilla JS, HTML e CSS puro), estruturado nas normas do Manifest V3 do Chrome para garantir ótima performance e respeito à privacidade do usuário.

- **`manifest.json`**: Configura permissões base (Storage, ContextMenus) e injeção do script.
- **`background.js` (Service Worker)**: Roda em segundo plano ouvindo os atalhos de teclado e delegando a comunicação com a aba ativa.
- **`content.js`**: Injetado nas abas. Manipula o DOM com segurança para aplicar classes CSS dos highlights baseados na precisão do XPath + Texto, além de injetar lógicas de scroll behavior.
- **`popup.html / popup.js`**: Interface flutuante leve gerenciada em abas, manipulando leitura e gravação assíncrona do `chrome.storage.local`.

## 📝 Licença

Desenvolvido para aprendizado e aumento de produtividade. Sinta-se totalmente à vontade para clonar, sugerir PRs, e modificar conforme a sua criatividade demandar!
