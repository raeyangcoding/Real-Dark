const extAPI = (typeof browser !== 'undefined') ? browser : chrome;

// ==========================================
// 实验性 API 检测
// ==========================================
const hasExperimentAPI = !!(extAPI.aboutConfigPrefs && extAPI.aboutConfigPrefs.setInt);
console.log('[RealDark BG] experiment API 可用:', hasExperimentAPI);

// ==========================================
// 第 1 层：theme.update() — 浏览器外壳颜色
// ==========================================
function applyBrowserChromeDark() {
  console.log('[RealDark BG] applyBrowserChromeDark()');
  try {
    extAPI.theme.update({
      colors: {
        ntp_background: "#1c1b22",
        ntp_text: "#fbfbfe",
        frame: "#1c1b22",
        tab_background_text: "#fbfbfe",
        toolbar: "#2b2a33",
        toolbar_text: "#fbfbfe"
      },
      properties: {
        content_color_scheme: "dark",
        color_scheme: "dark"
      }
    });
    console.log('[RealDark BG] theme.update() dark 成功');
  } catch (e) {
    console.error('[RealDark BG] theme.update() dark 失败:', e);
    try {
      extAPI.theme.update({
        colors: {
          ntp_background: "#1c1b22",
          ntp_text: "#fbfbfe",
          frame: "#1c1b22",
          tab_background_text: "#fbfbfe",
          toolbar: "#2b2a33",
          toolbar_text: "#fbfbfe"
        }
      });
      console.log('[RealDark BG] theme.update() colors-only 回退成功');
    } catch (e2) {
      console.error('[RealDark BG] 回退也失败:', e2);
    }
  }
}

function applyBrowserChromeLight() {
  console.log('[RealDark BG] applyBrowserChromeLight()');
  try {
    extAPI.theme.reset();
    console.log('[RealDark BG] theme.reset() 成功');
  } catch (e) {
    console.error('[RealDark BG] theme.reset() 失败:', e);
  }
}

// ==========================================
// 第 2 层：browserSettings — 网页内容 prefers-color-scheme
// ==========================================
function setWebContentScheme(scheme) {
  if (!extAPI.browserSettings || !extAPI.browserSettings.overrideContentColorScheme) {
    console.warn('[RealDark BG] browserSettings API 不可用');
    return;
  }
  console.log(`[RealDark BG] browserSettings → "${scheme}"`);
  try {
    extAPI.browserSettings.overrideContentColorScheme.set({ value: scheme });
  } catch (e) {
    console.error('[RealDark BG] browserSettings 设置失败:', e);
  }
}

// ==========================================
// 第 3 层：experiment API — about:config 直接操作！
// 控制 browser.theme.content-theme (0=dark, 1=light, 2=system)
// ==========================================
const CONTENT_THEME_PREF = "browser.theme.content-theme";

async function setBuiltinPageTheme(dark) {
  if (!hasExperimentAPI) {
    console.warn('[RealDark BG] experiment API 不可用，无法控制 about: 页面颜色');
    console.warn('[RealDark BG] 请确保通过 about:debugging 加载，并使用 Firefox Dev Edition 或 Nightly');
    return;
  }
  const target = dark ? 0 : 1; // 0=dark, 1=light
  const label = dark ? 'dark (0)' : 'light (1)';
  console.log(`[RealDark BG] experiment API → 设置 ${CONTENT_THEME_PREF} = ${target} (${label})`);
  try {
    await extAPI.aboutConfigPrefs.setInt(CONTENT_THEME_PREF, target);
    // 验证
    const actual = await extAPI.aboutConfigPrefs.getInt(CONTENT_THEME_PREF);
    console.log(`[RealDark BG] 验证: ${CONTENT_THEME_PREF} = ${actual}`);
  } catch (e) {
    console.error(`[RealDark BG] 设置 ${CONTENT_THEME_PREF} 失败:`, e);
  }
}

// ==========================================
// 组合调用：同时控制三层
// ==========================================
async function applyFullDarkTheme() {
  console.log('[RealDark BG] === 应用完整深色模式 ===');
  applyBrowserChromeDark();           // 第 1 层：外壳
  setWebContentScheme("dark");        // 第 2 层：网页内容
  await setBuiltinPageTheme(true);    // 第 3 层：about: 内置页面 ⭐
}

async function applyFullLightTheme() {
  console.log('[RealDark BG] === 恢复完整亮色模式 ===');
  applyBrowserChromeLight();          // 第 1 层：外壳
  setWebContentScheme("auto");        // 第 2 层：网页内容
  await setBuiltinPageTheme(false);   // 第 3 层：about: 内置页面 ⭐
}

// ==========================================
// 时间与日出日落计算逻辑
// ==========================================
function parseTimeString(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function getSunsetSunrise(lat, lng) {
  const date = new Date();
  const rad = Math.PI / 180;

  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date - startOfYear;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  const declination = 23.45 * Math.sin(rad * (360 / 365) * (dayOfYear - 81));

  const cosHourAngle = (Math.cos(rad * 90.83) - Math.sin(rad * lat) * Math.sin(rad * declination)) /
                       (Math.cos(rad * lat) * Math.cos(rad * declination));

  if (cosHourAngle > 1) return { sunrise: parseTimeString("06:00"), sunset: parseTimeString("18:00") };
  if (cosHourAngle < -1) return { sunrise: parseTimeString("00:01"), sunset: parseTimeString("23:59") };

  const hourAngle = Math.acos(cosHourAngle) / rad;
  const noonOffset = (lng / 15);

  const sunriseUTC = 12 - noonOffset - (hourAngle / 15);
  const sunsetUTC = 12 - noonOffset + (hourAngle / 15);

  const sunrise = new Date(date);
  sunrise.setUTCHours(Math.floor(sunriseUTC), (sunriseUTC % 1) * 60, 0);

  const sunset = new Date(date);
  sunset.setUTCHours(Math.floor(sunsetUTC), (sunsetUTC % 1) * 60, 0);

  return { sunrise, sunset };
}

// ==========================================
// 业务调度中心
// ==========================================
async function checkAndApplyTheme() {
  console.log('[RealDark BG] checkAndApplyTheme() 触发');

  extAPI.storage.local.get('realDarkConfig', async (data) => {
    const config = data.realDarkConfig;
    console.log('[RealDark BG] 当前配置:', JSON.stringify(config));

    if (!config || config.enabled === false) {
      console.log('[RealDark BG] 扩展禁用 → 恢复亮色');
      await applyFullLightTheme();
      return;
    }

    const now = new Date();
    let isNight = false;

    if (config.mode === 'time') {
      const lightD = parseTimeString(config.lightTime || '07:00');
      const darkD = parseTimeString(config.darkTime || '19:00');

      if (darkD > lightD) {
        isNight = (now >= darkD || now < lightD);
      } else {
        isNight = (now >= darkD && now < lightD);
      }
      console.log(`[RealDark BG] 时间模式 — now=${now.toTimeString()}, light=${config.lightTime}, dark=${config.darkTime}, isNight=${isNight}`);
    } else if (config.mode === 'sun') {
      const lat = parseFloat(config.lat);
      const lng = parseFloat(config.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        const times = getSunsetSunrise(lat, lng);
        isNight = (now >= times.sunset || now < times.sunrise);
        console.log(`[RealDark BG] 日出日落 — 日出=${times.sunrise.toTimeString()}, 日落=${times.sunset.toTimeString()}, isNight=${isNight}`);
      }
    }

    if (isNight) {
      await applyFullDarkTheme();
    } else {
      await applyFullLightTheme();
    }
  });
}

// ==========================================
// 事件监听
// ==========================================
extAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[RealDark BG] 收到消息:', JSON.stringify(request));
  if (request.action === "UPDATE_THEME") {
    checkAndApplyTheme();
    sendResponse({ status: "ok" });
    return true;
  }
  if (request.action === "STATUS_CHECK") {
    sendResponse({
      experimentAPI: hasExperimentAPI,
      message: hasExperimentAPI
        ? "about: 内置页面深色控制可用"
        : "请使用 Firefox Dev Edition 加载以获得完整功能"
    });
    return true;
  }
});

extAPI.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.realDarkConfig) {
    console.log('[RealDark BG] storage 变化:', JSON.stringify(changes.realDarkConfig.newValue));
    checkAndApplyTheme();
  }
});

extAPI.runtime.onStartup.addListener(checkAndApplyTheme);
extAPI.runtime.onInstalled.addListener((details) => {
  console.log('[RealDark BG] onInstalled, reason:', details.reason);
  if (details.reason === 'install') {
    extAPI.storage.local.set({
      realDarkConfig: {
        enabled: true,
        mode: 'time',
        lightTime: '07:00',
        darkTime: '19:00',
        lat: '',
        lng: ''
      }
    }, () => {
      checkAndApplyTheme();
    });
  } else {
    checkAndApplyTheme();
  }
});

if (extAPI.alarms) {
  extAPI.alarms.clear("checkThemeAlarm", () => {
    extAPI.alarms.create("checkThemeAlarm", { periodInMinutes: 1 });
  });
  extAPI.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkThemeAlarm") {
      console.log('[RealDark BG] alarm 触发');
      checkAndApplyTheme();
    }
  });
} else {
  setInterval(checkAndApplyTheme, 60000);
}

console.log('[RealDark BG] 后台初始化完成，首次检查...');
checkAndApplyTheme();
