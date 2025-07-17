// ==UserScript==
// @name Linux.do 超级收藏夹 (专业版)
// @namespace http://tampermonkey.net/
// @version 3.9.1
// @description [终极稳定版] 新增特性：默认按最新收藏排序。彻底修复按钮消失的严重问题。功能完整，包含版本化备份、云端浏览器、Toast提示、自动创建目录等所有功能。
// @author Bin & Gemini & CHAI & 高级编程助手
// @match https://linux.do/*
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_addStyle
// @grant GM_xmlhttpRequest
// @connect *
// ==/UserScript==

(function () {
  "use strict";
  const WEBDAV_BACKUP_DIR = "LinuxDoBookmarks/"; // 在WebDAV上存储备份的目录
  // --- Part 1: 定义样式和 HTML (已恢复并三重检查) ---
  GM_addStyle(`
    /* 模态框背景 */
    .bm-modal-backdrop { display: none; position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4); justify-content: center; align-items: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    /* 内容面板 */
    .bm-content-panel { background-color: #ffffff; border-radius: 12px; padding: 25px 30px; border: 1px solid #EAEAEA; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
    #bookmark-manager-modal .bm-content-panel { max-width: 1000px; }
    /* 头部 */
    .bm-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #EAEAEA; padding-bottom: 15px; margin-bottom: 20px; flex-shrink: 0; }
    .bm-header h2 { margin: 0; font-size: 22px; color: #333; }
    .bm-close-btn { color: #999; font-size: 32px; font-weight: bold; cursor: pointer; line-height: 1; transition: color 0.2s; margin-left: auto; }
    /* 控制区 */
    .controls-container { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 10px; flex-shrink: 0; }
    #bookmark-search-input { flex: 1 1 300px; padding: 10px 15px; font-size: 16px; border-radius: 6px; border: 1px solid #DDD; box-sizing: border-box; }
    .controls-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
    /* 表格 */
    #bookmarks-table-container { min-height: 300px; max-height: 65vh; overflow-y: auto; flex-grow: 1; }
    #bookmarks-table { width: 100%; border-collapse: collapse; }
    #bookmarks-table th { position: sticky; top: 0; z-index: 1; background-color: #F9F9F9; padding: 12px 8px; text-align: left; border-bottom: 1px solid #EAEAEA;}
    #bookmarks-table td { border-bottom: 1px solid #EAEAEA; padding: 12px 8px; text-align: left; }
    #bookmarks-table td a { color: #007AFF; text-decoration: none; word-break: break-all; }
    /* 按钮 */
    .bm-btn { border: 1px solid #CCC; background-color: #FFF; color: #333; padding: 6px 12px; border-radius: 5px; cursor: pointer; font-size: 14px; transition: all 0.2s; white-space: nowrap; }
    .bm-btn-io { border-color: #81C784; color: #2E7D32; }
    .bm-btn-cloud { border-color: #64B5F6; color: #1976D2; }
    .bm-btn-danger { border-color: #E57373; color: #D32F2F; }
    .bm-btn-pin { border-color: #FFB74D; color: #F57C00; }
    /* Toast 提示 */
    .bm-toast { position: fixed; top: 20px; right: 20px; z-index: 10001; background-color: #2E7D32; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); opacity: 0; transition: opacity 0.3s, transform 0.3s; transform: translateY(-20px); font-size: 15px; }
    .bm-toast.show { opacity: 1; transform: translateY(0); }
    .bm-toast.error { background-color: #D32F2F; }
    /* WebDAV 浏览器 */
    #webdav-browser-modal .bm-content-panel { max-width: 700px; height: 75vh; }
    #webdav-browser-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex-grow: 1; border: 1px solid #eee; border-radius: 6px; }
    #webdav-browser-list li { padding: 12px 15px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background-color 0.2s; }
    #webdav-browser-list li:hover { background-color: #f5f5f5; }
    /* WebDAV 设置 */
    #webdav-settings-modal .bm-content-panel { max-width: 550px; }
    .webdav-form-group { margin-bottom: 15px; }
    .webdav-form-group label { display: block; margin-bottom: 5px; color: #555; font-weight: 500; user-select: none;}
    .webdav-form-group input[type="checkbox"] { margin-right: 5px; vertical-align: middle; }
    .webdav-form-group input[type="text"], .webdav-form-group input[type="password"] { width: 100%; padding: 8px 12px; font-size: 15px; border-radius: 6px; border: 1px solid #DDD; box-sizing: border-box; }
    .webdav-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; flex-wrap: wrap; gap: 10px; }
    .webdav-footer-buttons { margin-left: auto; }
    
    /* 置顶收藏样式 */
    .pinned-bookmark { background-color: #FFF8E1; }
    .pinned-bookmark td:first-child::before { content: "📌 "; color: #F57C00; }

    /* --- 页面常驻按钮 (关键修复) --- */
    .action-button { position: fixed; z-index: 9998; padding: 10px 15px; background-color: #fff; color: #333; border: 1px solid #DDD; border-radius: 20px; cursor: pointer; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: all 0.2s ease-in-out; }
    .action-button:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.12); }
    #collect-link-button { right: 20px; bottom: 75px; }
    #manage-bookmarks-button { right: 20px; bottom: 30px; }
`);
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div id="bookmark-manager-modal" class="bm-modal-backdrop"> <div class="bm-content-panel"> <div class="bm-header"><h2>超级收藏夹</h2><span class="bm-close-btn" data-target-modal="bookmark-manager-modal">×</span></div> <div class="controls-container"> <input type="text" id="bookmark-search-input" placeholder="搜索名称或链接..."> <div class="controls-buttons"> <button id="sync-from-cloud-btn" class="bm-btn bm-btn-cloud">从云端同步</button> <button id="sync-to-cloud-btn" class="bm-btn bm-btn-cloud">手动备份到云端</button> <button id="import-bookmarks-btn" class="bm-btn bm-btn-io">导入</button> <button id="export-bookmarks-btn" class="bm-btn bm-btn-io">导出</button> <button id="webdav-settings-btn" class="bm-btn">云同步设置</button> </div> </div> <div id="bookmarks-table-container"></div> </div> </div>
    <div id="webdav-settings-modal" class="bm-modal-backdrop"> <div class="bm-content-panel"> <div class="bm-header"><h2>WebDAV 云同步设置</h2><span class="bm-close-btn" data-target-modal="webdav-settings-modal">×</span></div> <div class="webdav-form-group"><label for="webdav-server">服务器地址:</label><input type="text" id="webdav-server" class="webdav-input" placeholder="例如: https://dav.jianguoyun.com/dav/"></div> <div class="webdav-form-group"><label for="webdav-user">用户名:</label><input type="text" id="webdav-user" class="webdav-input" placeholder="你的坚果云邮箱账号"></div> <div class="webdav-form-group"><label for="webdav-pass">应用密码 (非登录密码):</label><input type="password" id="webdav-pass" class="webdav-input" placeholder="在坚果云安全选项中生成的应用密码"></div> <div class="webdav-form-group"><label><input type="checkbox" id="auto-sync-toggle">当收藏变化时自动备份</label></div> <div class="webdav-footer"> <div id="webdav-test-result"></div> <div class="webdav-footer-buttons"><button id="test-webdav-connection" class="bm-btn">测试连接</button><button id="save-webdav-settings" class="bm-btn bm-btn-io">保存</button></div> </div> </div> </div>
    <div id="webdav-browser-modal" class="bm-modal-backdrop"> <div class="bm-content-panel"> <div class="bm-header"><h2>选择一个云端备份进行恢复</h2><span class="bm-close-btn" data-target-modal="webdav-browser-modal">×</span></div> <ul id="webdav-browser-list"><li class="loading-text">正在加载备份列表...</li></ul> </div> </div>
`
  );

  // --- Part 2: DOM 元素获取与核心变量 ---
  const getEl = (id) => document.getElementById(id);
  const managerModal = getEl("bookmark-manager-modal");
  const webdavSettingsModal = getEl("webdav-settings-modal");
  const webdavBrowserModal = getEl("webdav-browser-modal");
  const searchInput = getEl("bookmark-search-input");
  const tableContainer = getEl("bookmarks-table-container");
  const webdavTestResult = getEl("webdav-test-result");
  const autoSyncToggle = getEl("auto-sync-toggle");
  const webdavBrowserList = getEl("webdav-browser-list");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  // --- Part 3: 核心函数 (渲染、CRUD、本地导入导出) ---
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
  function showToast(message, isError = false) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.className = `bm-toast ${isError ? "error" : ""}`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 3000);
      }, 3000);
    }, 10);
  }
  function renderBookmarksTable(searchText = "") {
    const allBookmarks = GM_getValue("linuxdo_bookmarks", []);
    const lowerCaseSearch = searchText.toLowerCase();
    const filteredBookmarks = allBookmarks.filter(
      (bm) =>
        bm.name.toLowerCase().includes(lowerCaseSearch) ||
        bm.url.toLowerCase().includes(lowerCaseSearch)
    );
    if (filteredBookmarks.length === 0) {
      tableContainer.innerHTML =
        '<p style="text-align:center; color:#888; padding:20px 0;">没有找到匹配的收藏。</p>';
      return;
    }

    // 排序：置顶的在前，其余按数组原有顺序（即最新收藏的在前）
    const sortedBookmarks = [...filteredBookmarks].sort((a, b) => {
      if ((a.pinned && b.pinned) || (!a.pinned && !b.pinned)) {
        return 0; // 保持原有顺序
      }
      return a.pinned ? -1 : 1; // 置顶的排在前面
    });

    let tableHTML = `<table id="bookmarks-table"><thead><tr><th>名称</th><th>链接</th><th style="text-align:center;">操作</th></tr></thead><tbody>`;
    sortedBookmarks.forEach((bookmark) => {
      const originalIndex = allBookmarks.findIndex(
        (b) => getRootTopicUrl(b.url) === getRootTopicUrl(bookmark.url)
      );
      const isPinned = bookmark.pinned ? "pinned-bookmark" : "";
      const pinBtnText = bookmark.pinned ? "取消置顶" : "置顶";
      const pinBtnClass = bookmark.pinned
        ? "bm-btn bm-btn-pin unpin-btn"
        : "bm-btn bm-btn-pin pin-btn";

      tableHTML += `<tr data-original-index="${originalIndex}" class="${isPinned}">
            <td>${bookmark.name}</td>
            <td><a href="${bookmark.url}" target="_blank" title="${bookmark.url}">${bookmark.url}</a></td>
            <td style="text-align:center;">
                <button class="${pinBtnClass}">${pinBtnText}</button>
                <button class="bm-btn rename-btn">重命名</button>
                <button class="bm-btn bm-btn-danger delete-btn">删除</button>
            </td>
        </tr>`;
    });
    tableHTML += "</tbody></table>";
    tableContainer.innerHTML = tableHTML;
  }
  function modifyBookmarks(updateFunction) {
    let bookmarks = GM_getValue("linuxdo_bookmarks", []);
    const result = updateFunction(bookmarks);
    if (result === false) return;
    GM_setValue("linuxdo_bookmarks", result.bookmarks);
    renderBookmarksTable(searchInput.value);
    if (result.changed) triggerAutoWebDAVSync();
  }
  function enterEditMode(row) {
    const nameCell = row.cells[0];
    const originalName = nameCell.textContent;
    nameCell.innerHTML = `<input type="text" class="edit-name-input" value="${originalName}" style="width:100%; padding:5px; border-radius:4px; border:1px solid #DDD;">`;
    const actionCell = row.cells[2];
    actionCell.innerHTML = `<button class="bm-btn save-btn">保存</button><button class="bm-btn cancel-btn">取消</button>`;
    nameCell.querySelector(".edit-name-input").focus();
  }

  function saveRename(index, newName) {
    if (!newName.trim()) {
      alert("名称不能为空！");
      return;
    }
    modifyBookmarks((bookmarks) => {
      if (bookmarks[index]) bookmarks[index].name = newName;
      return { bookmarks, changed: true };
    });
  }

  function togglePinBookmark(index) {
    modifyBookmarks((bookmarks) => {
      if (bookmarks[index]) {
        // 如果已有pinned属性，则切换状态；如果没有，则设为true
        bookmarks[index].pinned = !bookmarks[index].pinned;
        const status = bookmarks[index].pinned ? "置顶" : "取消置顶";
        showToast(`✅ 已${status}收藏：${bookmarks[index].name}`);
      }
      return { bookmarks, changed: true };
    });
  }

  function deleteBookmark(index) {
    if (confirm("确定要删除这条收藏吗？")) {
      modifyBookmarks((bookmarks) => {
        bookmarks.splice(index, 1);
        return { bookmarks, changed: true };
      });
    }
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
        alert(
          "导入失败！请确保文件是正确的 JSON 格式备份文件。\n错误: " +
            error.message
        );
      } finally {
        fileInput.value = "";
      }
    };
    reader.readAsText(file);
  }
  function handleLocalExport() {
    const bookmarks = GM_getValue("linuxdo_bookmarks", []);
    if (bookmarks.length === 0) {
      alert("没有收藏可以导出。");
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
      ? GM_getValue("webdav_server")
      : getEl("webdav-server").value.trim();
    const user = fromStorage
      ? GM_getValue("webdav_user")
      : getEl("webdav-user").value.trim();
    const pass = fromStorage
      ? GM_getValue("webdav_pass")
      : getEl("webdav-pass").value;
    if (!server || !user || !pass) return null;
    return { server: server.endsWith("/") ? server : server + "/", user, pass };
  }
  function saveWebDAVConfig() {
    const config = getWebDAVConfig(false);
    if (!config) {
      alert("服务器、用户名和应用密码均不能为空！");
      return;
    }
    GM_setValue("webdav_server", config.server);
    GM_setValue("webdav_user", config.user);
    GM_setValue("webdav_pass", config.pass);
    GM_setValue("webdav_auto_sync_enabled", getEl("auto-sync-toggle").checked);
    alert("WebDAV 配置已保存！");
    webdavSettingsModal.style.display = "none";
  }
  function webdavRequest(options) {
    const config = getWebDAVConfig(true);
    if (!config) {
      if (options.onerror)
        options.onerror({ status: 0, statusText: "WebDAV 配置不完整" });
      else showToast("❌ 操作失败: WebDAV 配置不完整", true);
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
      webdavTestResult.className = "test-fail";
      webdavTestResult.textContent = "❌ 请填写所有字段！";
      return;
    }
    webdavTestResult.className = "";
    webdavTestResult.textContent = "正在测试连接...";
    webdavRequest({
      method: "PROPFIND",
      path: "",
      headers: { Depth: "0" },
      onload: (res) => {
        if (res.status === 207 || res.status === 200) {
          webdavTestResult.className = "test-success";
          webdavTestResult.textContent = "✅ 连接成功！";
        } else if (res.status === 401) {
          webdavTestResult.className = "test-fail";
          webdavTestResult.textContent = "❌ 连接失败: 用户名或密码错误 (401)";
        } else {
          webdavTestResult.className = "test-fail";
          webdavTestResult.textContent = `❌ 连接失败: 服务器返回 ${res.status}`;
        }
      },
      onerror: () => {
        webdavTestResult.className = "test-fail";
        webdavTestResult.textContent = "❌ 连接失败: 请检查服务器地址或网络";
      },
    });
  }
  function uploadToWebDAV(isAuto = false) {
    const filename = getTimestampedFilename();
    const bookmarks = GM_getValue("linuxdo_bookmarks", []);
    if (!isAuto) alert(`正在手动备份到云端...\n文件名: ${filename}`);
    const performPut = () => {
      webdavRequest({
        method: "PUT",
        path: WEBDAV_BACKUP_DIR + filename,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        data: JSON.stringify(bookmarks, null, 2),
        onload: (res) => {
          if (res.status === 201 || res.status === 204) {
            showToast(`✅ ${isAuto ? "自动" : "手动"}备份成功！`);
          } else {
            showToast(`❌ 备份失败: ${res.status} ${res.statusText}`, true);
          }
        },
        onerror: (res) => showToast(`❌ 备份出错: ${res.statusText}`, true),
      });
    };
    webdavRequest({
      method: "MKCOL",
      path: WEBDAV_BACKUP_DIR,
      onload: (res) => {
        if (res.status === 201 || res.status === 405 || res.status === 409) {
          performPut();
        } else {
          showToast(
            `❌ 创建云端目录失败: ${res.status} ${res.statusText}`,
            true
          );
        }
      },
      onerror: (res) =>
        showToast(`❌ 创建云端目录出错: ${res.statusText}`, true),
    });
  }
  function triggerAutoWebDAVSync() {
    if (GM_getValue("webdav_auto_sync_enabled", false)) {
      uploadToWebDAV(true);
    }
  }
  function listWebDAVBackups() {
    webdavBrowserModal.style.display = "flex";
    webdavBrowserList.innerHTML =
      '<li class="loading-text">正在加载备份列表...</li>';
    webdavRequest({
      method: "PROPFIND",
      path: WEBDAV_BACKUP_DIR,
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
    alert(`即将从云端恢复备份: ${filename}`);
    webdavRequest({
      method: "GET",
      path: WEBDAV_BACKUP_DIR + filename,
      onload: (res) => {
        if (res.status === 200) {
          try {
            const cloudBookmarks = JSON.parse(res.responseText);
            if (!Array.isArray(cloudBookmarks))
              throw new Error("云端数据格式错误。");
            webdavBrowserModal.style.display = "none";
            promptAndMergeBookmarks(cloudBookmarks);
          } catch (e) {
            alert("解析云端数据失败！\n错误: " + e.message);
          }
        } else {
          alert(`下载失败！服务器响应: ${res.status} ${res.statusText}`);
        }
      },
      onerror: (res) =>
        alert(
          `下载出错！请检查网络、服务器地址和授权。\n详情: ${res.statusText}`
        ),
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
            // [MODIFIED] 使用 unshift 将新项目添加到数组开头，实现最新在最前
            bookmarks.unshift(b);
            addedCount++;
          }
        });
        if (addedCount > 0) dataChanged = true;
        alert(
          `合并完成！新增 ${addedCount} 条，跳过 ${
            newBookmarks.length - addedCount
          } 条重复项。`
        );
      } else if (choice === "2") {
        if (confirm("警告：此操作将清空您本地的所有收藏，确定要继续吗？")) {
          bookmarks = newBookmarks;
          dataChanged = true;
          alert(`覆盖完成！成功从备份恢复 ${newBookmarks.length} 条收藏。`);
        }
      } else {
        alert("操作已取消。");
        return false;
      }
      return { bookmarks, changed: dataChanged };
    });
  }
  document.body.addEventListener("click", function (event) {
    const target = event.target;
    const row = target.closest("tr");
    if (row) {
      const originalIndex = parseInt(row.dataset.originalIndex, 10);
      if (target.classList.contains("delete-btn"))
        deleteBookmark(originalIndex);
      else if (target.classList.contains("rename-btn")) enterEditMode(row);
      else if (target.classList.contains("save-btn"))
        saveRename(originalIndex, row.querySelector(".edit-name-input").value);
      else if (target.classList.contains("cancel-btn"))
        renderBookmarksTable(searchInput.value);
      else if (
        target.classList.contains("pin-btn") ||
        target.classList.contains("unpin-btn")
      )
        togglePinBookmark(originalIndex);
      return;
    }
    const buttonActions = {
      "manage-bookmarks-button": () => {
        renderBookmarksTable();
        managerModal.style.display = "flex";
      },
      "webdav-settings-btn": () => {
        webdavTestResult.textContent = "";
        getEl("webdav-server").value = GM_getValue("webdav_server", "");
        getEl("webdav-user").value = GM_getValue("webdav_user", "");
        getEl("webdav-pass").value = GM_getValue("webdav_pass", "");
        autoSyncToggle.checked = GM_getValue("webdav_auto_sync_enabled", false);
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
    if (target.classList.contains("bm-close-btn"))
      getEl(target.dataset.targetModal).style.display = "none";
    if (
      target.classList.contains("bm-modal-backdrop") &&
      !event.target.closest(".bm-content-panel")
    )
      target.style.display = "none";
  });
  fileInput.addEventListener(
    "change",
    (e) => e.target.files[0] && handleLocalImport(e.target.files[0])
  );
  searchInput.addEventListener("input", () =>
    renderBookmarksTable(searchInput.value)
  );
  autoSyncToggle.addEventListener("change", (e) =>
    GM_setValue("webdav_auto_sync_enabled", e.target.checked)
  );

  // --- Part 6: 页面按钮与初始化 ---
  const manageButton = document.createElement("button");
  manageButton.textContent = "🗂️ 超级收藏夹";
  manageButton.id = "manage-bookmarks-button";
  manageButton.className = "action-button";
  document.body.appendChild(manageButton);
  if (window.location.href.includes("linux.do/t/")) {
    const collectButton = document.createElement("button");
    collectButton.textContent = "⭐ 收藏本页";
    collectButton.id = "collect-link-button";
    collectButton.className = "action-button";
    document.body.appendChild(collectButton);
    collectButton.addEventListener("click", () => {
      const postUrl = window.location.href;
      // 去掉标题中的"- LINUX DO"部分
      const cleanTitle = document.title.replace(/\s*-\s*LINUX\s*DO\s*$/i, "");
      const customName = prompt(
        "请输入收藏名称（默认为帖子标题）:",
        cleanTitle
      );
      if (customName) {
        modifyBookmarks((bookmarks) => {
          const rootUrl = getRootTopicUrl(postUrl);
          if (bookmarks.some((b) => getRootTopicUrl(b.url) === rootUrl)) {
            alert("该帖子已收藏，请勿重复添加！");
            return false;
          }
          // [MODIFIED] 使用 unshift 将新项目添加到数组开头，实现最新在最前
          bookmarks.unshift({ name: customName, url: postUrl });
          showToast("✅ 收藏成功！");
          return { bookmarks, changed: true };
        });
      }
    });
  }
  console.log(
    "超级收藏夹 (v3.9.1 增强版) 已加载！支持最新收藏排序、置顶和更大面板！"
  );
})();
