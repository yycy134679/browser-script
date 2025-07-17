// ==UserScript==
// @name         Linux.do 超级收藏夹 (v5.0 标签版)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  [Major Feature] 新增标签系统！自动从标题提取标签，支持按标签筛选。UI全面升级，功能更强大。
// @author       Bin & Gemini & CHAI & 高级编程助手
// @match        https://linux.do/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      *
// ==/UserScript==

(function () {
  "use strict";

  // [REFACTORED] 使用常量管理所有键名、ID和类名，提高可维护性
  const CONSTANTS = {
    STORAGE_KEYS: {
      BOOKMARKS: "linuxdo_bookmarks",
      WEBDAV_SERVER: "webdav_server",
      WEBDAV_USER: "webdav_user",
      WEBDAV_PASS: "webdav_pass",
      AUTO_SYNC: "webdav_auto_sync_enabled",
    },
    IDS: {
      MANAGER_MODAL: "bookmark-manager-modal",
      WEBDAV_SETTINGS_MODAL: "webdav-settings-modal",
      WEBDAV_BROWSER_MODAL: "webdav-browser-modal",
      SEARCH_INPUT: "bookmark-search-input",
      TABLE_CONTAINER: "bookmarks-table-container",
      TABLE: "bookmarks-table",
      ROW_TEMPLATE: "bm-row-template",
      TAG_FILTER_CONTAINER: "bm-tag-filter-container", // [NEW]
      WEBDAV_TEST_RESULT: "webdav-test-result",
      AUTO_SYNC_TOGGLE: "auto-sync-toggle",
      WEBDAV_BROWSER_LIST: "webdav-browser-list",
      COLLECT_BUTTON: "collect-link-button",
      MANAGE_BUTTON: "manage-bookmarks-button",
    },
    CLASSES: {
      DELETE_BTN: "delete-btn",
      RENAME_BTN: "rename-btn",
      SAVE_BTN: "save-btn",
      CANCEL_BTN: "cancel-btn",
      PIN_BTN: "pin-btn",
      UNPIN_BTN: "unpin-btn",
      PINNED_ROW: "pinned-bookmark",
      EDIT_INPUT: "edit-name-input",
      MODAL_BACKDROP: "bm-modal-backdrop",
      CLOSE_BTN: "bm-close-btn",
      CONTENT_PANEL: "bm-content-panel",
      ROW_HIDING: "bm-row-hiding",
      TAG_FILTER_BTN: "bm-tag-filter-btn", // [NEW]
      TAG_ACTIVE: "active", // [NEW]
      TAG_CELL: "bm-tag-cell", // [NEW]
      TAG_PILL: "bm-tag-pill", // [NEW]
    },
    WEBDAV_DIR: "LinuxDoBookmarks/",
  };

  let undoState = { item: null, index: -1, timeoutId: null };
  let activeTagFilter = null; // [NEW] 用于存储当前激活的标签过滤器

  // --- Part 1: 定义样式和 HTML ---
  GM_addStyle(`
        .bm-modal-backdrop { display: none; position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4); justify-content: center; align-items: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .bm-content-panel { background-color: #ffffff; border-radius: 12px; padding: 25px 30px; border: 1px solid #EAEAEA; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
        #${CONSTANTS.IDS.MANAGER_MODAL} .bm-content-panel { max-width: 1000px; }
        .bm-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #EAEAEA; padding-bottom: 15px; margin-bottom: 20px; flex-shrink: 0; }
        .bm-header h2 { margin: 0; font-size: 22px; color: #333; }
        .bm-close-btn { color: #999; font-size: 32px; font-weight: bold; cursor: pointer; line-height: 1; transition: color 0.2s; margin-left: auto; }
        .controls-container { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 15px; gap: 10px; flex-shrink: 0; }
        #${CONSTANTS.IDS.SEARCH_INPUT} { flex: 1 1 300px; padding: 10px 15px; font-size: 16px; border-radius: 6px; border: 1px solid #DDD; box-sizing: border-box; }
        .controls-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
        #${CONSTANTS.IDS.TABLE_CONTAINER} { min-height: 300px; max-height: 60vh; overflow-y: auto; flex-grow: 1; }
        #${CONSTANTS.IDS.TABLE} { width: 100%; border-collapse: collapse; }
        #${CONSTANTS.IDS.TABLE} th { position: sticky; top: 0; z-index: 1; background-color: #F9F9F9; padding: 12px 8px; text-align: left; border-bottom: 1px solid #EAEAEA;}
        #${CONSTANTS.IDS.TABLE} td { border-bottom: 1px solid #EAEAEA; padding: 12px 8px; text-align: left; transition: background-color 0.3s; vertical-align: middle; }
        #${CONSTANTS.IDS.TABLE} td a { color: #007AFF; text-decoration: none; word-break: break-all; }
        .bm-btn { border: 1px solid #CCC; background-color: #FFF; color: #333; padding: 6px 12px; border-radius: 5px; cursor: pointer; font-size: 14px; transition: all 0.2s; white-space: nowrap; }
        .bm-btn-io { border-color: #81C784; color: #2E7D32; }
        .bm-btn-cloud { border-color: #64B5F6; color: #1976D2; }
        .bm-btn-danger { border-color: #E57373; color: #D32F2F; }
        .bm-btn-pin { border-color: #FFB74D; color: #F57C00; }
        .bm-toast { position: fixed; bottom: 20px; right: 20px; z-index: 10001; background-color: #333; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); opacity: 0; transition: opacity 0.3s, transform 0.3s; transform: translateY(20px); font-size: 15px; display: flex; align-items: center; gap: 10px; }
        .bm-toast.show { opacity: 1; transform: translateY(0); }
        .bm-toast.error { background-color: #D32F2F; }
        .bm-toast-action { color: #4CAF50; font-weight: bold; cursor: pointer; text-decoration: underline; }
        #${CONSTANTS.IDS.WEBDAV_BROWSER_MODAL} .bm-content-panel { max-width: 700px; height: 75vh; }
        #${CONSTANTS.IDS.WEBDAV_BROWSER_LIST} { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex-grow: 1; border: 1px solid #eee; border-radius: 6px; }
        #${CONSTANTS.IDS.WEBDAV_BROWSER_LIST} li { padding: 12px 15px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background-color 0.2s; }
        #${CONSTANTS.IDS.WEBDAV_BROWSER_LIST} li:hover { background-color: #f5f5f5; }
        #${CONSTANTS.IDS.WEBDAV_SETTINGS_MODAL} .bm-content-panel { max-width: 550px; }
        .webdav-form-group { margin-bottom: 15px; }
        .webdav-form-group label { display: block; margin-bottom: 5px; color: #555; font-weight: 500; user-select: none;}
        .webdav-form-group input[type="checkbox"] { margin-right: 5px; vertical-align: middle; }
        .webdav-form-group input[type="text"], .webdav-form-group input[type="password"] { width: 100%; padding: 8px 12px; font-size: 15px; border-radius: 6px; border: 1px solid #DDD; box-sizing: border-box; }
        .webdav-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; flex-wrap: wrap; gap: 10px; }
        .webdav-footer-buttons { margin-left: auto; }
        .${CONSTANTS.CLASSES.PINNED_ROW} { background-color: #FFF8E1; }
        .${CONSTANTS.CLASSES.PINNED_ROW} td:first-child::before { content: "📌 "; color: #F57C00; }
        .action-button { position: fixed; z-index: 9998; padding: 10px 15px; background-color: #fff; color: #333; border: 1px solid #DDD; border-radius: 20px; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: all 0.2s ease-in-out; }
        .action-button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.12); }
        #${CONSTANTS.IDS.COLLECT_BUTTON} { right: 20px; bottom: 75px; }
        #${CONSTANTS.IDS.MANAGE_BUTTON} { right: 20px; bottom: 30px; }
        .${CONSTANTS.CLASSES.ROW_HIDING} { opacity: 0; transform: scale(0.95); }
        #${CONSTANTS.IDS.TABLE} tr { transition: opacity 0.3s ease, transform 0.3s ease; }
        /* [NEW] Tag Styles */
        #${CONSTANTS.IDS.TAG_FILTER_CONTAINER} { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #EAEAEA; }
        .${CONSTANTS.CLASSES.TAG_FILTER_BTN} { border: 1px solid #DDD; background-color: #FAFAFA; color: #555; padding: 5px 10px; border-radius: 15px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
        .${CONSTANTS.CLASSES.TAG_FILTER_BTN}.${CONSTANTS.CLASSES.TAG_ACTIVE} { background-color: #007AFF; color: white; border-color: #007AFF; }
        .${CONSTANTS.CLASSES.TAG_PILL} { display: inline-block; background-color: #EFEFEF; color: #555; padding: 3px 8px; border-radius: 10px; font-size: 12px; margin-right: 5px; margin-bottom: 5px; }
    `);

  document.body.insertAdjacentHTML(
    "beforeend",
    `
        <div id="${CONSTANTS.IDS.MANAGER_MODAL}" class="${CONSTANTS.CLASSES.MODAL_BACKDROP}"> <div class="bm-content-panel"> <div class="bm-header"><h2>超级收藏夹</h2><span class="${CONSTANTS.CLASSES.CLOSE_BTN}" data-target-modal="${CONSTANTS.IDS.MANAGER_MODAL}">×</span></div> <div class="controls-container"> <input type="text" id="${CONSTANTS.IDS.SEARCH_INPUT}" placeholder="搜索名称、链接、标签..."> <div class="controls-buttons"> <button id="sync-from-cloud-btn" class="bm-btn bm-btn-cloud">☁️ 从云端同步</button> <button id="sync-to-cloud-btn" class="bm-btn bm-btn-cloud">☁️ 手动备份</button> <button id="import-bookmarks-btn" class="bm-btn bm-btn-io">📥 导入</button> <button id="export-bookmarks-btn" class="bm-btn bm-btn-io">📤 导出</button> <button id="webdav-settings-btn" class="bm-btn">⚙️ 云同步设置</button> </div> </div> <div id="${CONSTANTS.IDS.TAG_FILTER_CONTAINER}"></div> <div id="${CONSTANTS.IDS.TABLE_CONTAINER}"></div> </div> </div>
        <div id="${CONSTANTS.IDS.WEBDAV_SETTINGS_MODAL}" class="${CONSTANTS.CLASSES.MODAL_BACKDROP}"> <div class="bm-content-panel"> <div class="bm-header"><h2>WebDAV 云同步设置</h2><span class="${CONSTANTS.CLASSES.CLOSE_BTN}" data-target-modal="${CONSTANTS.IDS.WEBDAV_SETTINGS_MODAL}">×</span></div> <div class="webdav-form-group"><label for="webdav-server">服务器地址:</label><input type="text" id="webdav-server" class="webdav-input" placeholder="例如: https://dav.jianguoyun.com/dav/"></div> <div class="webdav-form-group"><label for="webdav-user">用户名:</label><input type="text" id="webdav-user" class="webdav-input"></div> <div class="webdav-form-group"><label for="webdav-pass">应用密码 (非登录密码):</label><input type="password" id="webdav-pass" class="webdav-input"></div> <div class="webdav-form-group"><label><input type="checkbox" id="${CONSTANTS.IDS.AUTO_SYNC_TOGGLE}">当收藏变化时自动备份</label></div> <div class="webdav-footer"> <div id="${CONSTANTS.IDS.WEBDAV_TEST_RESULT}"></div> <div class="webdav-footer-buttons"><button id="test-webdav-connection" class="bm-btn">测试连接</button><button id="save-webdav-settings" class="bm-btn bm-btn-io">保存</button></div> </div> </div> </div>
        <div id="${CONSTANTS.IDS.WEBDAV_BROWSER_MODAL}" class="${CONSTANTS.CLASSES.MODAL_BACKDROP}"> <div class="bm-content-panel"> <div class="bm-header"><h2>选择一个云端备份进行恢复</h2><span class="${CONSTANTS.CLASSES.CLOSE_BTN}" data-target-modal="${CONSTANTS.IDS.WEBDAV_BROWSER_MODAL}">×</span></div> <ul id="${CONSTANTS.IDS.WEBDAV_BROWSER_LIST}"><li class="loading-text">正在加载备份列表...</li></ul> </div> </div>
        <template id="${CONSTANTS.IDS.ROW_TEMPLATE}">
             <tr data-url-key="">
                <td class="bm-name-cell"></td>
                <td class="bm-url-cell"><a href="" target="_blank" title=""></a></td>
                <td class="${CONSTANTS.CLASSES.TAG_CELL}"></td>
                <td class="bm-actions-cell" style="text-align:center; white-space:nowrap;">
                    <button class="bm-btn bm-btn-pin ${CONSTANTS.CLASSES.PIN_BTN}">📌 置顶</button>
                    <button class="bm-btn ${CONSTANTS.CLASSES.RENAME_BTN}">✏️ 重命名</button>
                    <button class="bm-btn bm-btn-danger ${CONSTANTS.CLASSES.DELETE_BTN}">🗑️ 删除</button>
                </td>
            </tr>
        </template>
    `
  );

  // --- Part 2: DOM 元素获取与核心变量 ---
  const getEl = (id) => document.getElementById(id);
  const managerModal = getEl(CONSTANTS.IDS.MANAGER_MODAL);
  const webdavSettingsModal = getEl(CONSTANTS.IDS.WEBDAV_SETTINGS_MODAL);
  const webdavBrowserModal = getEl(CONSTANTS.IDS.WEBDAV_BROWSER_MODAL);
  const searchInput = getEl(CONSTANTS.IDS.SEARCH_INPUT);
  const tableContainer = getEl(CONSTANTS.IDS.TABLE_CONTAINER);
  const webdavTestResult = getEl(CONSTANTS.IDS.WEBDAV_TEST_RESULT);
  const autoSyncToggle = getEl(CONSTANTS.IDS.AUTO_SYNC_TOGGLE);
  const webdavBrowserList = getEl(CONSTANTS.IDS.WEBDAV_BROWSER_LIST);
  const rowTemplate = getEl(CONSTANTS.IDS.ROW_TEMPLATE);
  const tagFilterContainer = getEl(CONSTANTS.IDS.TAG_FILTER_CONTAINER);
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  // --- Part 3: 核心函数 ---
  const getRootTopicUrl = (url) =>
    (url.match(/(https:\/\/linux\.do\/t\/[^\/]+\/\d+)/) || [])[0] || url;
  const pad = (num) => num.toString().padStart(2, "0");
  const getTimestampedFilename = () => {
    const d = new Date();
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}`;
    const time = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(
      d.getSeconds()
    )}`;
    return `linuxdo-backup-${date}_${time}.json`;
  };

  function showToast(message, options = {}) {
    const { isError = false, duration = 3000, actions = [] } = options;
    const toast = document.createElement("div");
    toast.className = `bm-toast ${isError ? "error" : ""}`;

    const messageSpan = document.createElement("span");
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    actions.forEach((action) => {
      const actionLink = document.createElement("a");
      actionLink.textContent = action.text;
      actionLink.className = "bm-toast-action";
      actionLink.onclick = (e) => {
        e.stopPropagation();
        action.onClick();
        toast.remove();
      };
      toast.appendChild(actionLink);
    });

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 500);
      }, duration);
    }, 10);
  }

  function renderTagFilters() {
    const allBookmarks = GM_getValue(CONSTANTS.STORAGE_KEYS.BOOKMARKS, []);
    const allTags = new Set();
    allBookmarks.forEach((bm) => bm.tags?.forEach((tag) => allTags.add(tag)));

    tagFilterContainer.innerHTML = "";

    const createButton = (text, tag) => {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.className = CONSTANTS.CLASSES.TAG_FILTER_BTN;
      btn.dataset.tag = tag === null ? "" : tag;
      if (activeTagFilter === tag) {
        btn.classList.add(CONSTANTS.CLASSES.TAG_ACTIVE);
      }
      return btn;
    };

    tagFilterContainer.appendChild(createButton("所有标签", null));
    Array.from(allTags)
      .sort()
      .forEach((tag) => {
        tagFilterContainer.appendChild(createButton(tag, tag));
      });
  }

  function renderBookmarksTable() {
    const searchText = searchInput.value.toLowerCase();
    const allBookmarks = GM_getValue(CONSTANTS.STORAGE_KEYS.BOOKMARKS, []);

    const filteredBookmarks = allBookmarks.filter((bm) => {
      const hasTag =
        !activeTagFilter || (bm.tags && bm.tags.includes(activeTagFilter));
      const hasText =
        !searchText ||
        bm.name.toLowerCase().includes(searchText) ||
        bm.url.toLowerCase().includes(searchText) ||
        (bm.tags && bm.tags.some((t) => t.toLowerCase().includes(searchText)));
      return hasTag && hasText;
    });

    if (filteredBookmarks.length === 0) {
      tableContainer.innerHTML =
        '<p style="text-align:center; color:#888; padding:20px 0;">没有找到匹配的收藏。</p>';
      return;
    }

    const sortedBookmarks = [...filteredBookmarks].sort((a, b) =>
      a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1
    );

    const table = document.createElement("table");
    table.id = CONSTANTS.IDS.TABLE;
    table.innerHTML = `<thead><tr><th style="width: 40%;">名称</th><th style="width: 30%;">链接</th><th style="width: 15%;">标签</th><th style="width: 15%; text-align:center;">操作</th></tr></thead>`;
    const tbody = document.createElement("tbody");

    sortedBookmarks.forEach((bookmark) => {
      const row = rowTemplate.content.cloneNode(true).firstElementChild;
      row.dataset.urlKey = getRootTopicUrl(bookmark.url);

      row.querySelector(".bm-name-cell").textContent = bookmark.name;
      const link = row.querySelector(".bm-url-cell a");
      link.href = bookmark.url;
      link.textContent = bookmark.url;
      link.title = bookmark.url;

      const tagCell = row.querySelector(`.${CONSTANTS.CLASSES.TAG_CELL}`);
      if (bookmark.tags && bookmark.tags.length > 0) {
        bookmark.tags.forEach((tag) => {
          const pill = document.createElement("span");
          pill.className = CONSTANTS.CLASSES.TAG_PILL;
          pill.textContent = tag;
          tagCell.appendChild(pill);
        });
      }

      const pinBtn = row.querySelector(`.${CONSTANTS.CLASSES.PIN_BTN}`);
      if (bookmark.pinned) {
        row.classList.add(CONSTANTS.CLASSES.PINNED_ROW);
        pinBtn.textContent = "📌 取消置顶";
        pinBtn.classList.add(CONSTANTS.CLASSES.UNPIN_BTN);
      } else {
        pinBtn.textContent = "📌 置顶";
        pinBtn.classList.remove(CONSTANTS.CLASSES.UNPIN_BTN);
      }
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableContainer.innerHTML = "";
    tableContainer.appendChild(table);
  }

  function modifyBookmarks(updateFunction) {
    let bookmarks = GM_getValue(CONSTANTS.STORAGE_KEYS.BOOKMARKS, []);
    const result = updateFunction(bookmarks);
    if (result === false) return;
    GM_setValue(CONSTANTS.STORAGE_KEYS.BOOKMARKS, result.bookmarks);
    if (result.changed) triggerAutoWebDAVSync();
    return result.bookmarks;
  }

  function enterEditMode(row) {
    const nameCell = row.querySelector(".bm-name-cell");
    const originalName = nameCell.textContent;
    nameCell.innerHTML = `<input type="text" class="${CONSTANTS.CLASSES.EDIT_INPUT}" value="${originalName}" style="width:100%; padding:5px; border-radius:4px; border:1px solid #DDD;">`;

    const actionCell = row.querySelector(".bm-actions-cell");
    const originalButtons = actionCell.innerHTML;
    actionCell.innerHTML = `<button class="bm-btn ${CONSTANTS.CLASSES.SAVE_BTN}">保存</button><button class="bm-btn ${CONSTANTS.CLASSES.CANCEL_BTN}">取消</button>`;

    const input = nameCell.querySelector(`.${CONSTANTS.CLASSES.EDIT_INPUT}`);
    input.focus();
    input.select();

    const cancelAction = () => {
      nameCell.textContent = originalName;
      actionCell.innerHTML = originalButtons;
    };

    row.querySelector(`.${CONSTANTS.CLASSES.SAVE_BTN}`).onclick = () =>
      saveRename(row, input.value);
    row.querySelector(`.${CONSTANTS.CLASSES.CANCEL_BTN}`).onclick =
      cancelAction;
    input.onkeydown = (e) => {
      if (e.key === "Enter") saveRename(row, input.value);
      if (e.key === "Escape") cancelAction();
    };
  }

  function saveRename(row, newName) {
    if (!newName.trim()) {
      showToast("名称不能为空！", { isError: true });
      return;
    }
    const urlKey = row.dataset.urlKey;
    modifyBookmarks((bookmarks) => {
      const bookmark = bookmarks.find((b) => getRootTopicUrl(b.url) === urlKey);
      if (bookmark) bookmark.name = newName;
      return { bookmarks, changed: true };
    });
    renderBookmarksTable();
    showToast("✅ 名称已更新！");
  }

  function togglePinBookmark(row) {
    const urlKey = row.dataset.urlKey;
    let status = "";
    modifyBookmarks((bookmarks) => {
      const bookmark = bookmarks.find((b) => getRootTopicUrl(b.url) === urlKey);
      if (bookmark) {
        bookmark.pinned = !bookmark.pinned;
        status = bookmark.pinned ? "置顶" : "取消置顶";
      }
      return { bookmarks, changed: true };
    });
    showToast(`✅ 已${status}收藏`);
    renderBookmarksTable();
  }

  function deleteBookmark(row) {
    if (undoState.timeoutId) {
      clearTimeout(undoState.timeoutId);
      modifyBookmarks((bookmarks) => {
        bookmarks.splice(undoState.index, 1);
        return { bookmarks, changed: true };
      });
    }

    const urlKey = row.dataset.urlKey;
    const allBookmarks = GM_getValue(CONSTANTS.STORAGE_KEYS.BOOKMARKS, []);
    const index = allBookmarks.findIndex(
      (b) => getRootTopicUrl(b.url) === urlKey
    );
    if (index === -1) return;

    undoState = { item: allBookmarks[index], index, timeoutId: null };

    row.classList.add(CONSTANTS.CLASSES.ROW_HIDING);
    setTimeout(() => (row.style.display = "none"), 300);

    undoState.timeoutId = setTimeout(() => {
      modifyBookmarks((bookmarks) => {
        bookmarks.splice(index, 1);
        return { bookmarks, changed: true };
      });
      undoState = { item: null, index: -1, timeoutId: null };
      renderTagFilters(); // Update tags if the last item of a tag was deleted
    }, 4000);

    showToast("已删除", {
      duration: 3800,
      actions: [{ text: "撤销", onClick: undoDelete }],
    });
  }

  function undoDelete() {
    if (!undoState.item) return;
    clearTimeout(undoState.timeoutId);

    const row = getEl(CONSTANTS.IDS.TABLE)?.querySelector(
      `tr[data-url-key="${getRootTopicUrl(undoState.item.url)}"]`
    );
    if (row) {
      row.style.display = "";
      setTimeout(() => row.classList.remove(CONSTANTS.CLASSES.ROW_HIDING), 10);
    } else {
      renderBookmarksTable();
    }

    undoState = { item: null, index: -1, timeoutId: null };
    showToast("✅ 已撤销删除");
  }

  function handleLocalImport(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedBookmarks = JSON.parse(e.target.result);
        if (!Array.isArray(importedBookmarks))
          throw new Error("文件格式不正确。");
        promptAndMergeBookmarks(importedBookmarks);
      } catch (error) {
        showToast("导入失败: " + error.message, { isError: true });
      } finally {
        fileInput.value = "";
      }
    };
    reader.readAsText(file);
  }

  function handleLocalExport() {
    const bookmarks = GM_getValue(CONSTANTS.STORAGE_KEYS.BOOKMARKS, []);
    if (bookmarks.length === 0) {
      showToast("没有收藏可以导出。", { isError: true });
      return;
    }
    const dataStr = JSON.stringify(bookmarks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "linuxdo_bookmarks_backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Part 4: WebDAV 核心功能 ---
  function getWebDAVConfig(fromStorage = true) {
    const server = fromStorage
      ? GM_getValue(CONSTANTS.STORAGE_KEYS.WEBDAV_SERVER)
      : getEl("webdav-server").value.trim();
    const user = fromStorage
      ? GM_getValue(CONSTANTS.STORAGE_KEYS.WEBDAV_USER)
      : getEl("webdav-user").value.trim();
    const pass = fromStorage
      ? GM_getValue(CONSTANTS.STORAGE_KEYS.WEBDAV_PASS)
      : getEl("webdav-pass").value;
    if (!server || !user || !pass) return null;
    return { server: server.endsWith("/") ? server : server + "/", user, pass };
  }
  function saveWebDAVConfig() {
    const config = getWebDAVConfig(false);
    if (!config) {
      showToast("服务器、用户名和应用密码均不能为空！", { isError: true });
      return;
    }
    GM_setValue(CONSTANTS.STORAGE_KEYS.WEBDAV_SERVER, config.server);
    GM_setValue(CONSTANTS.STORAGE_KEYS.WEBDAV_USER, config.user);
    GM_setValue(CONSTANTS.STORAGE_KEYS.WEBDAV_PASS, config.pass);
    GM_setValue(
      CONSTANTS.STORAGE_KEYS.AUTO_SYNC,
      getEl(CONSTANTS.IDS.AUTO_SYNC_TOGGLE).checked
    );
    showToast("✅ WebDAV 配置已保存！");
    webdavSettingsModal.style.display = "none";
  }
  function webdavRequest(options) {
    const config = getWebDAVConfig(true);
    if (!config) {
      if (options.onerror)
        options.onerror({ status: 0, statusText: "WebDAV 配置不完整" });
      else showToast("❌ 操作失败: WebDAV 配置不完整", { isError: true });
      return;
    }
    GM_xmlhttpRequest({
      method: options.method,
      url: config.server + (options.path || ""),
      headers: {
        Authorization: "Basic " + btoa(config.user + ":" + config.pass),
        ...options.headers,
      },
      data: options.data,
      onload: options.onload,
      onerror: options.onerror,
    });
  }
  function testWebDAVConnection() {
    const config = getWebDAVConfig(false);
    if (!config) {
      webdavTestResult.textContent = "❌ 请填写所有字段！";
      return;
    }
    webdavTestResult.textContent = "正在测试连接...";
    webdavRequest({
      method: "PROPFIND",
      path: "",
      headers: { Depth: "0" },
      onload: (res) => {
        if (res.status === 207 || res.status === 200)
          webdavTestResult.textContent = "✅ 连接成功！";
        else if (res.status === 401)
          webdavTestResult.textContent = "❌ 连接失败: 用户名或密码错误 (401)";
        else
          webdavTestResult.textContent = `❌ 连接失败: 服务器返回 ${res.status}`;
      },
      onerror: () =>
        (webdavTestResult.textContent = "❌ 连接失败: 请检查服务器地址或网络"),
    });
  }
  function uploadToWebDAV(isAuto = false) {
    const filename = getTimestampedFilename();
    const bookmarks = GM_getValue(CONSTANTS.STORAGE_KEYS.BOOKMARKS, []);
    if (!isAuto) showToast(`正在手动备份到云端...`);
    const performPut = () => {
      webdavRequest({
        method: "PUT",
        path: CONSTANTS.WEBDAV_DIR + filename,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        data: JSON.stringify(bookmarks, null, 2),
        onload: (res) => {
          if (res.status === 201 || res.status === 204)
            showToast(`✅ ${isAuto ? "自动" : "手动"}备份成功！`);
          else
            showToast(`❌ 备份失败: ${res.status} ${res.statusText}`, {
              isError: true,
            });
        },
        onerror: (res) =>
          showToast(`❌ 备份出错: ${res.statusText}`, { isError: true }),
      });
    };
    webdavRequest({
      method: "MKCOL",
      path: CONSTANTS.WEBDAV_DIR,
      onload: (res) => {
        if ([201, 405, 409].includes(res.status)) performPut();
        else
          showToast(`❌ 创建云端目录失败: ${res.status} ${res.statusText}`, {
            isError: true,
          });
      },
      onerror: (res) =>
        showToast(`❌ 创建云端目录出错: ${res.statusText}`, { isError: true }),
    });
  }
  function triggerAutoWebDAVSync() {
    if (GM_getValue(CONSTANTS.STORAGE_KEYS.AUTO_SYNC, false)) {
      uploadToWebDAV(true);
    }
  }
  function listWebDAVBackups() {
    webdavBrowserModal.style.display = "flex";
    webdavBrowserList.innerHTML =
      '<li class="loading-text">正在加载备份列表...</li>';
    webdavRequest({
      method: "PROPFIND",
      path: CONSTANTS.WEBDAV_DIR,
      headers: { Depth: "1" },
      onload: (res) => {
        if (res.status !== 207) {
          webdavBrowserList.innerHTML = `<li class="loading-text">加载失败: ${res.statusText} (请确保目录已存在)</li>`;
          return;
        }
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(
          res.responseText,
          "application/xml"
        );
        const files = Array.from(xmlDoc.getElementsByTagName("d:href"))
          .map((node) => node.textContent.split("/").pop())
          .filter(
            (name) =>
              name.startsWith("linuxdo-backup-") && name.endsWith(".json")
          )
          .sort()
          .reverse();
        if (files.length === 0) {
          webdavBrowserList.innerHTML =
            '<li class="loading-text">云端没有找到任何备份文件。</li>';
          return;
        }
        webdavBrowserList.innerHTML = "";
        files.forEach((file) => {
          const li = document.createElement("li");
          li.textContent = file;
          li.onclick = () => downloadFromWebDAV(file);
          webdavBrowserList.appendChild(li);
        });
      },
      onerror: (res) =>
        (webdavBrowserList.innerHTML = `<li class="loading-text">加载出错: ${res.statusText}</li>`),
    });
  }
  function downloadFromWebDAV(filename) {
    showToast(`即将从云端恢复备份: ${filename}`);
    webdavRequest({
      method: "GET",
      path: CONSTANTS.WEBDAV_DIR + filename,
      onload: (res) => {
        if (res.status === 200) {
          try {
            const cloudBookmarks = JSON.parse(res.responseText);
            if (!Array.isArray(cloudBookmarks))
              throw new Error("云端数据格式错误。");
            webdavBrowserModal.style.display = "none";
            promptAndMergeBookmarks(cloudBookmarks);
          } catch (e) {
            showToast("解析云端数据失败！" + e.message, { isError: true });
          }
        } else {
          showToast(`下载失败！服务器响应: ${res.status} ${res.statusText}`, {
            isError: true,
          });
        }
      },
      onerror: (res) =>
        showToast(`下载出错！详情: ${res.statusText}`, { isError: true }),
    });
  }

  // --- Part 5: 通用逻辑与事件绑定 ---
  function promptAndMergeBookmarks(newBookmarks) {
    const choice = prompt(
      "请选择恢复模式：\n1. 增量合并 (智能去重)\n2. 完全覆盖 (清空本地后恢复)\n\n请输入数字 1 或 2"
    );
    let dataChanged = false;
    modifyBookmarks((bookmarks) => {
      if (choice === "1") {
        const currentUrls = new Set(
          bookmarks.map((b) => getRootTopicUrl(b.url))
        );
        let addedCount = 0;
        newBookmarks.forEach((b) => {
          if (b.url && !currentUrls.has(getRootTopicUrl(b.url))) {
            bookmarks.unshift(b);
            addedCount++;
          }
        });
        if (addedCount > 0) dataChanged = true;
        showToast(
          `合并完成！新增 ${addedCount} 条，跳过 ${
            newBookmarks.length - addedCount
          } 条。`
        );
      } else if (choice === "2") {
        if (confirm("警告：此操作将清空您本地的所有收藏，确定要继续吗？")) {
          bookmarks = newBookmarks;
          dataChanged = true;
          showToast(`覆盖完成！成功恢复 ${newBookmarks.length} 条收藏。`);
        }
      } else {
        showToast("操作已取消。");
        return false;
      }
      return { bookmarks, changed: dataChanged };
    });
    renderBookmarksTable();
  }

  document.body.addEventListener("click", function (event) {
    const target = event.target;

    if (target.classList.contains(CONSTANTS.CLASSES.TAG_FILTER_BTN)) {
      const tag = target.dataset.tag === "" ? null : target.dataset.tag;
      activeTagFilter = tag;
      renderTagFilters();
      renderBookmarksTable();
      return;
    }

    const row = target.closest("tr");
    if (row && row.dataset.urlKey) {
      if (target.classList.contains(CONSTANTS.CLASSES.DELETE_BTN))
        deleteBookmark(row);
      else if (target.classList.contains(CONSTANTS.CLASSES.RENAME_BTN))
        enterEditMode(row);
      else if (target.classList.contains(CONSTANTS.CLASSES.PIN_BTN))
        togglePinBookmark(row);
      return;
    }

    const buttonActions = {
      "manage-bookmarks-button": () => {
        activeTagFilter = null;
        renderTagFilters();
        renderBookmarksTable();
        managerModal.style.display = "flex";
      },
      "webdav-settings-btn": () => {
        webdavTestResult.textContent = "";
        getEl("webdav-server").value = GM_getValue(
          CONSTANTS.STORAGE_KEYS.WEBDAV_SERVER,
          ""
        );
        getEl("webdav-user").value = GM_getValue(
          CONSTANTS.STORAGE_KEYS.WEBDAV_USER,
          ""
        );
        getEl("webdav-pass").value = GM_getValue(
          CONSTANTS.STORAGE_KEYS.WEBDAV_PASS,
          ""
        );
        autoSyncToggle.checked = GM_getValue(
          CONSTANTS.STORAGE_KEYS.AUTO_SYNC,
          false
        );
        webdavSettingsModal.style.display = "flex";
      },
      "save-webdav-settings": saveWebDAVConfig,
      "test-webdav-connection": testWebDAVConnection,
      "import-bookmarks-btn": () => fileInput.click(),
      "export-bookmarks-btn": handleLocalExport,
      "sync-from-cloud-btn": listWebDAVBackups,
      "sync-to-cloud-btn": () => uploadToWebDAV(false),
    };

    if (buttonActions[target.id]) buttonActions[target.id]();
    if (target.classList.contains(CONSTANTS.CLASSES.CLOSE_BTN))
      getEl(target.dataset.targetModal).style.display = "none";
    if (
      target.classList.contains(CONSTANTS.CLASSES.MODAL_BACKDROP) &&
      !event.target.closest(`.${CONSTANTS.CLASSES.CONTENT_PANEL}`)
    )
      target.style.display = "none";
  });

  fileInput.addEventListener(
    "change",
    (e) => e.target.files[0] && handleLocalImport(e.target.files[0])
  );
  searchInput.addEventListener("input", () => renderBookmarksTable());
  autoSyncToggle.addEventListener("change", (e) =>
    GM_setValue(CONSTANTS.STORAGE_KEYS.AUTO_SYNC, e.target.checked)
  );

  // --- Part 6: 页面按钮与初始化 ---
  const manageButton = document.createElement("button");
  manageButton.textContent = "🗂️ 超级收藏夹";
  manageButton.id = CONSTANTS.IDS.MANAGE_BUTTON;
  manageButton.className = "action-button";
  document.body.appendChild(manageButton);

  if (window.location.href.includes("linux.do/t/")) {
    const collectButton = document.createElement("button");
    collectButton.textContent = "⭐ 收藏本页";
    collectButton.id = CONSTANTS.IDS.COLLECT_BUTTON;
    collectButton.className = "action-button";
    document.body.appendChild(collectButton);

    collectButton.addEventListener("click", () => {
      const postUrl = window.location.href;
      const fullTitle = document.title.replace(/\s*-\s*LINUX\s*DO\s*$/i, "");
      const urlKey = getRootTopicUrl(postUrl);

      let cleanTitle = fullTitle;
      let tags = [];

      const tagMatch = fullTitle.match(/\s*-\s*([^\-]+)$/);
      if (tagMatch && tagMatch[1]) {
        // 1. 获取原始的、完整的标签字符串
        const rawTagString = tagMatch[1].trim();

        // 2. 使用正则表达式 /[\/,]/ (匹配斜杠或逗号) 来分割字符串，并只取第一部分
        const primaryTag = rawTagString.split(/[\/,]/)[0].trim();

        // 3. 将处理后的主标签添加到数组
        tags.push(primaryTag);

        // 4. 从标题中移除整个原始标签部分
        cleanTitle = fullTitle.replace(tagMatch[0], "").trim();
      }

      const newBookmarks = modifyBookmarks((bookmarks) => {
        if (bookmarks.some((b) => getRootTopicUrl(b.url) === urlKey)) {
          showToast("该帖子已收藏，请勿重复添加！", { isError: true });
          return false;
        }
        bookmarks.unshift({
          name: cleanTitle,
          url: postUrl,
          pinned: false,
          tags: tags,
        });
        return { bookmarks, changed: true };
      });

      if (newBookmarks) {
        showToast("✅ 收藏成功！");
      }
    });
  }

  console.log("超级收藏夹 (v5.0 标签版) 已加载！");
})();
