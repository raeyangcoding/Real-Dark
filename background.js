// background.js

// 每分钟检查一次状态
chrome.alarms.create('checkStatus', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkStatus') {
        updateDarkModeStatus();
    }
});

// 监听设置变化
chrome.storage.onChanged.addListener((changes) => {
    if (changes.mode || changes.darkTime || changes.lightTime || changes.latitude || changes.longitude) {
        updateDarkModeStatus();
    }
});

async function updateDarkModeStatus() {
    const state = await chrome.storage.local.get({
        mode: 'time',
        darkTime: '19:00',
        lightTime: '07:00',
        latitude: '39.90',
        longitude: '116.40'
    });

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    let isDark = false;

    if (state.mode === 'time') {
        const [darkH, darkM] = state.darkTime.split(':').map(Number);
        const [lightH, lightM] = state.lightTime.split(':').map(Number);
        const darkTotal = darkH * 60 + darkM;
        const lightTotal = lightH * 60 + lightM;

        if (darkTotal > lightTotal) {
            // 夜间跨越午夜 (例如 19:00 到 07:00)
            isDark = currentTime >= darkTotal || currentTime < lightTotal;
        } else {
            // 夜间不跨越午夜 (例如 07:00 到 19:00 是白天)
            isDark = currentTime >= darkTotal && currentTime < lightTotal;
        }
    } else {
        // 日出日落模式
        const { sunrise, sunset } = getSunTimes(state.latitude, state.longitude);
        isDark = currentTime >= sunset || currentTime < sunrise;
    }

    const { isDark: oldIsDark } = await chrome.storage.local.get('isDark');
    if (isDark !== oldIsDark) {
        await chrome.storage.local.set({ isDark });
    }

    // 无论 isDark 是否改变，都设置一次以确保状态一致
    // 使用 Firefox 原生 browserSettings API
    // 0: system, 1: light, 2: dark
    if (typeof browser !== 'undefined' && browser.browserSettings && browser.browserSettings.overrideContentColorScheme) {
        await browser.browserSettings.overrideContentColorScheme.set({ value: isDark ? 2 : 1 });
    } else {
        // 兼容性处理，如果是在非 Firefox 或 API 不可用
        console.warn('browserSettings.overrideContentColorScheme is not available.');
    }
}

// 简单的日出日落计算 (近似值)
function getSunTimes(lat, lng) {
    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    
    // 非常简化的公式
    // 假设春分/秋分日出 6:00, 日落 18:00
    // 纬度影响白昼长度
    const latRad = lat * Math.PI / 180;
    const declination = 0.409 * Math.sin(2 * Math.PI * (dayOfYear - 81) / 365);
    const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(declination));
    
    const sunsetMinutes = 12 * 60 + (hourAngle * 180 / Math.PI / 15) * 60 - (lng - 120) * 4; // 假设东八区 (120)
    const sunriseMinutes = 12 * 60 - (hourAngle * 180 / Math.PI / 15) * 60 - (lng - 120) * 4;

    return {
        sunrise: sunriseMinutes,
        sunset: sunsetMinutes
    };
}

// 初始更新
updateDarkModeStatus();
