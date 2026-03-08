// 由于 <script> 标签放在了 <body> 的最后，代码执行时 DOM 已经完全存在
// 直接使用 IIFE (立即执行函数) 即可，避免扩展弹窗下 DOMContentLoaded 不触发的 Bug
(function() {
  const radios = document.querySelectorAll('input[name="mode"]');
  const panelTime = document.getElementById('panel-time');
  const panelSun = document.getElementById('panel-sun');
  const btnLoc = document.getElementById('getLocation');
  const btnSave = document.getElementById('save');
  
  const lightTimeInput = document.getElementById('lightTime');
  const darkTimeInput = document.getElementById('darkTime');
  const latInput = document.getElementById('latitude');
  const lngInput = document.getElementById('longitude');

  // 用于动态注入的内置 SVG 字符串
  const iconLoader = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
  const iconCheckCircle = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 text-emerald-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`;
  const iconCheckLarge = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M20 6 9 17l-5-5"/></svg>`;
  const iconLoaderLarge = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

  // 0. 加载保存的状态
  chrome.storage.local.get({
    mode: 'time',
    darkTime: '19:00',
    lightTime: '07:00',
    latitude: '39.90',
    longitude: '116.40'
  }, (state) => {
    // 初始化 UI 值
    const targetRadio = document.querySelector(`input[name="mode"][value="${state.mode}"]`);
    if (targetRadio) targetRadio.checked = true;
    
    lightTimeInput.value = state.lightTime;
    darkTimeInput.value = state.darkTime;
    latInput.value = state.latitude;
    lngInput.value = state.longitude;
    
    // 初始显示对应面板
    switchPanel(state.mode);
  });

  // 1. 面板平滑切换逻辑
  function switchPanel(mode) {
    if (mode === 'time') {
      panelSun.classList.add('hidden');
      panelSun.classList.remove('fade-enter');
      
      panelTime.classList.remove('hidden');
      // 触发重绘以实现 CSS 动画
      void panelTime.offsetWidth; 
      panelTime.classList.add('fade-enter');
    } else {
      panelTime.classList.add('hidden');
      panelTime.classList.remove('fade-enter');
      
      panelSun.classList.remove('hidden');
      void panelSun.offsetWidth;
      panelSun.classList.add('fade-enter');
    }
  }

  // 绑定切换事件
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) switchPanel(e.target.value);
    });
  });

  // 2. 获取定位按钮交互逻辑
  if (btnLoc) {
    btnLoc.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const originalHtml = btn.innerHTML;
      
      // 变成 Loading 状态
      btn.innerHTML = `${iconLoader} 正在定位...`;
      btn.classList.add('bg-slate-100', 'text-slate-500');
      
      // 尝试获取地理位置
      navigator.geolocation.getCurrentPosition(
        (position) => {
          latInput.value = position.coords.latitude.toFixed(2);
          lngInput.value = position.coords.longitude.toFixed(2);
          
          btn.innerHTML = `${iconCheckCircle} 定位成功`;
          btn.classList.remove('text-slate-500');
          btn.classList.add('text-slate-900', 'bg-emerald-50', 'border-emerald-200');
          
          setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('bg-emerald-50', 'border-emerald-200', 'text-slate-900', 'bg-slate-100');
          }, 2000);
        },
        (error) => {
          // 定位失败，填充默认值
          latInput.value = "39.90"; 
          lngInput.value = "116.40"; 
          
          btn.innerHTML = `<span class="text-orange-500">定位受限(已填默认)</span>`;
          
          setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('bg-slate-100', 'text-slate-500');
          }, 2000);
        },
        { timeout: 5000 }
      );
    });
  }

  // 3. 核心保存按钮动效逻辑
  if (btnSave) {
    btnSave.addEventListener('click', function() {
      const btn = this;
      const originalHtml = btn.innerHTML;
      
      // 变成 Loading 状态
      btn.innerHTML = `${iconLoaderLarge} <span>保存中...</span>`;
      
      // 保存数据到 storage
      const data = {
        mode: document.querySelector('input[name="mode"]:checked').value,
        lightTime: lightTimeInput.value,
        darkTime: darkTimeInput.value,
        latitude: latInput.value,
        longitude: lngInput.value
      };

      chrome.storage.local.set(data, () => {
        // 模拟后台存储耗时动效
        setTimeout(() => {
          // 变成绿色成功状态
          btn.innerHTML = `${iconCheckLarge} <span>已保存</span>`;
          btn.classList.replace('bg-slate-900', 'bg-emerald-600');
          btn.classList.replace('hover:bg-slate-800', 'hover:bg-emerald-700');
          btn.classList.replace('shadow-[0_4px_14px_0_rgba(15,23,42,0.2)]', 'shadow-[0_4px_14px_0_rgba(5,150,105,0.3)]');
          
          // 提示完毕后恢复初始黑灰色
          setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.replace('bg-emerald-600', 'bg-slate-900');
            btn.classList.replace('hover:bg-emerald-700', 'hover:bg-slate-800');
            btn.classList.replace('shadow-[0_4px_14px_0_rgba(5,150,105,0.3)]', 'shadow-[0_4px_14px_0_rgba(15,23,42,0.2)]');
          }, 1500);
        }, 500);
      });
    });
  }
})();
