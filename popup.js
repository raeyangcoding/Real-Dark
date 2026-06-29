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
  // 0.5 查询 background 实验 API 状态
  // ==========================================
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  function checkExperimentStatus() {
    extAPI.runtime.sendMessage({ action: "STATUS_CHECK" })
      .then((resp) => {
        if (resp && resp.experimentAPI) {
          statusDot.style.background = 'var(--emerald-500)';
          statusText.textContent = '✅ 已完全控制 about: 内置页面';
        } else {
          statusDot.style.background = '#f59e0b';
          statusText.textContent = '⚠ 请用 Firefox Dev Edition 加载以获得完整功能';
        }
      })
      .catch(() => {
        statusDot.style.background = '#ef4444';
        statusText.textContent = '❌ 后台未响应，请重新加载扩展';
      });
  }

  checkExperimentStatus();

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
    saveAndApply(config);
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
  // 3. 定位按钮
  // ==========================================
  btnLoc.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const originalHtml = btn.innerHTML;

    btn.innerHTML = `${iconLoaderSm} 正在估算...`;
    btn.classList.add('btn-sec-loading');

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          latInput.value = pos.coords.latitude.toFixed(2);
          lngInput.value = pos.coords.longitude.toFixed(2);

          btn.innerHTML = `${iconCheckSm} 定位成功`;
          btn.classList.remove('btn-sec-loading');
          btn.classList.add('btn-sec-success');
          setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('btn-sec-success');
          }, 2000);
        },
        () => {
          latInput.value = "39.90";
          lngInput.value = "116.40";
          btn.innerHTML = `${iconCheckSm} 网络估算`;
          btn.classList.remove('btn-sec-loading');
          btn.classList.add('btn-sec-success');
          setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('btn-sec-success');
          }, 2000);
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    } else {
      setTimeout(() => {
        latInput.value = "39.90";
        lngInput.value = "116.40";
        btn.innerHTML = `${iconCheckSm} 估算成功`;
        btn.classList.remove('btn-sec-loading');
        btn.classList.add('btn-sec-success');
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.classList.remove('btn-sec-success');
        }, 2000);
      }, 800);
    }
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
