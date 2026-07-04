(function() {
  const extAPI = (typeof browser !== 'undefined') ? browser : chrome;

  // 动态内置图标
  const iconLoaderSm = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
  const iconCheckSm = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3-5" style="color:var(--emerald-600)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`;

  const iconLoaderLg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
  const iconCheckLg = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

  const masterToggle = document.getElementById('masterToggle');
  const settingsArea = document.getElementById('settingsArea');
  const radios = document.querySelectorAll('input[name="mode"]');
  const panelTime = document.getElementById('panel-time');
  const panelSun = document.getElementById('panel-sun');
  const btnLoc = document.getElementById('getLocation');
  const btnSave = document.getElementById('save');
  const lightTimeInput = document.getElementById('lightTime');
  const darkTimeInput = document.getElementById('darkTime');
  const latInput = document.getElementById('latitude');
  const lngInput = document.getElementById('longitude');

  // ==========================================
  // 工具函数：收集当前设置
  // ==========================================
  function collectConfig() {
    const selectedMode = document.querySelector('input[name="mode"]:checked');
    return {
      enabled: masterToggle.checked,
      mode: selectedMode ? selectedMode.value : 'time',
      lightTime: lightTimeInput.value || '07:00',
      darkTime: darkTimeInput.value || '19:00',
      lat: latInput.value || '',
      lng: lngInput.value || ''
    };
  }

  // ==========================================
  // 工具函数：保存设置到 storage 并通知 background
  // ==========================================
  function saveAndApply(config, callback) {
    console.log('[RealDark Popup] 保存设置:', JSON.stringify(config));
    extAPI.storage.local.set({ realDarkConfig: config }, () => {
      if (extAPI.runtime.lastError) {
        console.error('[RealDark Popup] 保存失败:', extAPI.runtime.lastError);
        if (callback) callback(false);
        return;
      }
      console.log('[RealDark Popup] 保存成功，通知 background...');
      extAPI.runtime.sendMessage({ action: "UPDATE_THEME" })
        .then((resp) => { console.log('[RealDark Popup] background 回应:', resp); })
        .catch((err) => { console.warn('[RealDark Popup] 消息发送失败:', err); });
      if (callback) callback(true);
    });
  }

  // ==========================================
  // 0. 启动时从 storage 加载已保存的设置
  // ==========================================
  function loadSettings() {
    console.log('[RealDark Popup] 加载已保存设置...');
    extAPI.storage.local.get('realDarkConfig', (data) => {
      const config = data.realDarkConfig;
      console.log('[RealDark Popup] 读取到的配置:', JSON.stringify(config));
      if (!config) {
        console.log('[RealDark Popup] 无已保存配置，使用默认值');
        return;
      }

      // 恢复主开关状态（先解除事件绑定再设置，避免触发 change 事件）
      masterToggle.checked = config.enabled;
      if (!config.enabled) {
        settingsArea.classList.add('settings-disabled');
      } else {
        settingsArea.classList.remove('settings-disabled');
      }

      // 恢复模式选择
      if (config.mode === 'sun') {
        document.querySelector('input[name="mode"][value="sun"]').checked = true;
        switchPanel('sun');
      } else {
        document.querySelector('input[name="mode"][value="time"]').checked = true;
        switchPanel('time');
      }

      // 恢复时间设置
      if (config.lightTime) lightTimeInput.value = config.lightTime;
      if (config.darkTime) darkTimeInput.value = config.darkTime;

      // 恢复经纬度
      if (config.lat) latInput.value = config.lat;
      if (config.lng) lngInput.value = config.lng;
    });
  }

  loadSettings();

  // ==========================================
  // 1. 总开关 — 立刻保存 + 立刻应用主题！
  // ==========================================
  masterToggle.addEventListener('change', (e) => {
    const on = e.target.checked;
    console.log('[RealDark Popup] 主开关切换:', on);

    if (on) {
      settingsArea.classList.remove('settings-disabled');
    } else {
      settingsArea.classList.add('settings-disabled');
    }

    // 立刻保存并应用
    const config = collectConfig();
    saveAndApply(config, (success) => {
      if (!success) {
        console.error('[RealDark Popup] 主开关保存失败！');
        // 视觉回弹：恢复开关状态
        masterToggle.checked = !on;
        if (on) {
          settingsArea.classList.add('settings-disabled');
        } else {
          settingsArea.classList.remove('settings-disabled');
        }
      }
    });
  });

  // ==========================================
  // 2. 模式面板切换
  // ==========================================
  function switchPanel(mode) {
    if (mode === 'time') {
      panelSun.classList.add('hidden');
      panelTime.classList.remove('hidden');
      panelTime.classList.remove('fade-enter');
      void panelTime.offsetWidth;
      panelTime.classList.add('fade-enter');
    } else {
      panelTime.classList.add('hidden');
      panelSun.classList.remove('hidden');
      panelSun.firstElementChild.classList.remove('fade-enter');
      void panelSun.offsetWidth;
      panelSun.firstElementChild.classList.add('fade-enter');
    }
  }

  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) switchPanel(e.target.value);
    });
  });

  // ==========================================
  // 3. 定位按钮 — 通过 background 脚本获取（生命周期稳定）
  // ==========================================
  btnLoc.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const originalHtml = btn.innerHTML;

    btn.innerHTML = `${iconLoaderSm} 正在定位...`;
    btn.classList.add('btn-sec-loading');

    // 发送给 background 脚本处理定位（避免 popup 生命周期问题）
    extAPI.runtime.sendMessage({ action: "GET_LOCATION" })
      .then((resp) => {
        if (resp && resp.ok) {
          latInput.value = resp.lat;
          lngInput.value = resp.lng;
          const label = resp.source === 'gps' ? 'GPS 定位' : 'IP 定位';
          btn.innerHTML = `${iconCheckSm} ${label}成功`;
        } else {
          // 全部失败，使用默认值
          latInput.value = "39.90";
          lngInput.value = "116.40";
          btn.innerHTML = `${iconCheckSm} 使用默认位置`;
        }
        btn.classList.remove('btn-sec-loading');
        btn.classList.add('btn-sec-success');
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.classList.remove('btn-sec-success');
        }, 2000);
      })
      .catch(() => {
        latInput.value = "39.90";
        lngInput.value = "116.40";
        btn.innerHTML = `${iconCheckSm} 后台无响应，使用默认`;
        btn.classList.remove('btn-sec-loading');
        btn.classList.add('btn-sec-success');
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.classList.remove('btn-sec-success');
        }, 2000);
      });
  });

  // ==========================================
  // 4. 保存按钮 — 保存时间/经纬度/模式等详细设置
  // ==========================================
  btnSave.addEventListener('click', function() {
    const btn = this;
    const originalHtml = btn.innerHTML;
    const config = collectConfig();

    btn.innerHTML = `${iconLoaderLg} <span>保存中...</span>`;

    saveAndApply(config, (success) => {
      if (success) {
        btn.innerHTML = `${iconCheckLg} <span>已保存</span>`;
        btn.classList.add('btn-pri-success');
      } else {
        btn.innerHTML = `<span>保存失败</span>`;
      }
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.classList.remove('btn-pri-success');
      }, 1500);
    });
  });
})();
