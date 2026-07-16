const extAPI = browser;

// ==========================================
// 唯一功能：browserSettings — 网页内容 prefers-color-scheme
// 完全不碰浏览器外壳（tab 栏/工具栏/新标签页）
// ==========================================
function setWebContentScheme(scheme) {
  if (!extAPI.browserSettings || !extAPI.browserSettings.overrideContentColorScheme) {
    console.warn('[RealDark BG] browserSettings API 不可用');
    return;
  }
  try {
    extAPI.browserSettings.overrideContentColorScheme.set({ value: scheme });
    console.log(`[RealDark BG] 网页方案 → "${scheme}"`);
  } catch (e) {
    console.error('[RealDark BG] browserSettings 失败:', e);
  }
}

function applyDark() {
  setWebContentScheme("dark");
}

function applyLight() {
  setWebContentScheme("auto");
}

// ==========================================
// 时间与日出日落计算
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
  const noonOffset = lng / 15;

  const sunriseUTC = 12 - noonOffset - (hourAngle / 15);
  const sunsetUTC = 12 - noonOffset + (hourAngle / 15);

  const normRise = ((sunriseUTC % 24) + 24) % 24;
  const normSet = ((sunsetUTC % 24) + 24) % 24;

  const sunrise = new Date(date);
  sunrise.setUTCHours(Math.floor(normRise), (normRise % 1) * 60, 0);

  const sunset = new Date(date);
  sunset.setUTCHours(Math.floor(normSet), (normSet % 1) * 60, 0);

  // 东经度地区（如中国、日本）：日出 UTC 时间落在上一个 UTC 日
  // 例如北京 sunriseUTC = -3.175 → normRise = 20.825，应设为 昨天 20:49 UTC
  // normRise > normSet 说明日出和日落在不同 UTC 日
  if (normRise > normSet) {
    sunrise.setDate(sunrise.getDate() - 1);
  }

  return { sunrise, sunset };
}

// ==========================================
// 调度中心
// ==========================================
async function checkAndApplyTheme() {
  console.log('[RealDark BG] checkAndApplyTheme() 触发');

  const data = await new Promise(resolve => {
    extAPI.storage.local.get('realDarkConfig', resolve);
  });

  const config = data.realDarkConfig;
  console.log('[RealDark BG] 配置:', JSON.stringify(config));

  if (!config || config.enabled === false) {
    console.log('[RealDark BG] 禁用 → 亮色');
    applyLight();
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
    console.log(`[RealDark BG] 时间 — now=${now.toTimeString()}, light=${config.lightTime}, dark=${config.darkTime}, isNight=${isNight}`);
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
    applyDark();
  } else {
    applyLight();
  }
}

// ==========================================
// 定位服务（在后台运行，生命周期稳定）
// ==========================================
function getLocationFromBrowser() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geolocation not available'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude.toFixed(2),
        lng: pos.coords.longitude.toFixed(2),
        source: 'gps'
      }),
      (err) => reject(err),
      { timeout: 15000, enableHighAccuracy: false }
    );
  });
}

async function getLocationFromIP() {
  try {
    const resp = await fetch('http://ip-api.com/json/?fields=lat,lon');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return { lat: data.lat.toFixed(2), lng: data.lon.toFixed(2), source: 'ip' };
  } catch (e) {
    console.warn('[RealDark BG] IP 定位失败:', e.message);
    return null;
  }
}

// ==========================================
// 事件监听
// ==========================================
extAPI.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log('[RealDark BG] 收到消息:', JSON.stringify(request));

  if (request.action === "UPDATE_THEME") {
    checkAndApplyTheme();
    sendResponse({ status: "ok" });
    return false;
  }

  if (request.action === "GET_LOCATION") {
    getLocationFromBrowser()
      .then(coords => sendResponse({ ok: true, ...coords }))
      .catch(async () => {
        const ipCoords = await getLocationFromIP();
        if (ipCoords) {
          sendResponse({ ok: true, ...ipCoords });
        } else {
          sendResponse({ ok: false, error: '定位失败' });
        }
      });
    return true;
  }
});

extAPI.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.realDarkConfig) {
    checkAndApplyTheme();
    rescheduleAlarms(changes.realDarkConfig.newValue);
  }
});

extAPI.runtime.onStartup.addListener(checkAndApplyTheme);
extAPI.runtime.onInstalled.addListener((details) => {
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
    }, checkAndApplyTheme);
  } else {
    checkAndApplyTheme();
  }
});

// ==========================================
// 智能调度：只在切换时间点触发 alarm，平时零开销
// ==========================================
const ALARM_LIGHT = "realDark_light";
const ALARM_DARK  = "realDark_dark";
const ALARM_RECALC = "realDark_recalc";

function clearMyAlarms() {
  if (!extAPI.alarms) return;
  extAPI.alarms.clear(ALARM_LIGHT);
  extAPI.alarms.clear(ALARM_DARK);
  extAPI.alarms.clear(ALARM_RECALC);
  extAPI.alarms.clear("checkStatus"); // 清理旧 MVP 泄漏的 alarm
}

function alarmAt(name, h, m) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1); // 明天
  extAPI.alarms.create(name, { when: target.getTime() });
  console.log(`[RealDark BG] alarm "${name}" 设在 ${target.toLocaleString()}`);
}

function rescheduleAlarms(config) {
  if (!extAPI.alarms) return;
  clearMyAlarms();
  if (!config || config.enabled === false) return;

  if (config.mode === 'time') {
    const [lh, lm] = (config.lightTime || '07:00').split(':').map(Number);
    const [dh, dm] = (config.darkTime || '19:00').split(':').map(Number);
    alarmAt(ALARM_LIGHT, lh, lm);
    alarmAt(ALARM_DARK, dh, dm);
  } else if (config.mode === 'sun') {
    const lat = parseFloat(config.lat);
    const lng = parseFloat(config.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      const { sunrise, sunset } = getSunsetSunrise(lat, lng);
      extAPI.alarms.create(ALARM_LIGHT, { when: sunrise.getTime() });
      extAPI.alarms.create(ALARM_DARK, { when: sunset.getTime() });
      // 每天 00:01 重算明天的日出日落
      alarmAt(ALARM_RECALC, 0, 1);
      console.log(`[RealDark BG] 日出 alarm: ${sunrise.toLocaleString()}, 日落 alarm: ${sunset.toLocaleString()}`);
    }
  }
}

if (extAPI.alarms) {
  extAPI.alarms.onAlarm.addListener((alarm) => {
    console.log(`[RealDark BG] alarm "${alarm.name}" 触发`);
    if (alarm.name === ALARM_LIGHT || alarm.name === ALARM_DARK) {
      checkAndApplyTheme().then(() => {
        // 读完 config 后重设 alarm
        extAPI.storage.local.get('realDarkConfig', (data) => {
          rescheduleAlarms(data.realDarkConfig);
        });
      });
    } else if (alarm.name === ALARM_RECALC) {
      // 午夜重算
      extAPI.storage.local.get('realDarkConfig', (data) => {
        rescheduleAlarms(data.realDarkConfig);
        checkAndApplyTheme();
      });
    }
  });
}

console.log('[RealDark BG] 初始化完成，首次检查...');
checkAndApplyTheme().then(() => {
  extAPI.storage.local.get('realDarkConfig', (data) => {
    rescheduleAlarms(data.realDarkConfig);
  });
});