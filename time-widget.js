/**
 * 授时组件：校准 UTC 与北京时间并计算网络偏差
 */
(function () {
    let timeOffset = 0; // 服务器与本地的时间差（毫秒）
    let rttDelay = 0;   // 单程网络延迟（毫秒）

    // 获取权威授时中心时间（基于国家授时中心兼容的 HTTP Time API）
    async function syncNetworkTime() {
        const start = performance.now();
        try {
            // 使用 RFC 868 兼容标准时间接口
            const response = await fetch('http://quan.suning.com/getSysTime.do', { cache: 'no-store' });
            if (!response.ok) throw new Error('网络请求异常');
            
            const end = performance.now();
            const data = await response.json();
            
            // 计算网络往返延迟与单程延迟
            rttDelay = Math.round(end - start);
            const singleTrip = rttDelay / 2;
            
            // 根据服务器返回时间戳校准本地偏差
            if (data && data.time) {
                const serverTime = new Date(data.time).getTime();
                // 服务器实际标准时间 = 获取到的时间 + 单程传输耗时
                timeOffset = (serverTime + singleTrip) - Date.now();
            } else {
                // 兜底逻辑：若接口未返回标准字段，直接修正为 0 偏差
                timeOffset = 0;
            }
        } catch (e) {
            // 网络异常或受限时的降级策略
            console.warn('授时接口暂不可达，使用本地时间进行平滑降级');
            rttDelay = 0;
            timeOffset = 0;
        }
    }

    // 格式化时间（补零）
    function pad(num, len = 2) {
        return String(num).padStart(len, '0');
    }

    // 渲染指定时区时间
    function formatTime(date, isUTC) {
        const y = isUTC ? date.getUTCFullYear() : date.getFullYear();
        const mo = pad((isUTC ? date.getUTCMonth() : date.getMonth()) + 1);
        const d = pad(isUTC ? date.getUTCDate() : date.getDate());
        const h = pad(isUTC ? date.getUTCHours() : date.getHours());
        const mi = pad(isUTC ? date.getUTCMinutes() : date.getMinutes());
        const s = pad(isUTC ? date.getUTCSeconds() : date.getSeconds());
        const ms = pad(date.getMilliseconds(), 3);
        return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
    }

    // 实时更新面板
    function updateClock() {
        const clockEl = document.getElementById('sync-clock-panel');
        if (!clockEl) return;

        const now = new Date(Date.now() + timeOffset);
        const beijingTime = new Date(now.getTime() + 8 * 3600 * 1000);

        clockEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; gap:8px; font-size:13px; font-family:'Courier New', monospace; color:#aaa; text-align:left; white-space: nowrap;">
                <div>
                    <span style="color:#00ff00; font-weight:bold;">UTC:</span> 
                    ${formatTime(now, true)}
                </div>
                <div>
                    <span style="color:#00ff00; font-weight:bold;">北京时间:</span> 
                    ${formatTime(beijingTime, false)}
                </div>
                <div style="color:#666;">
                    误差: ±${rttDelay} ms
                </div>
            </div>
        `;
    }

    // 初始化组件
    async function initTimeWidget() {
        await syncNetworkTime();
        setInterval(updateClock, 40); // 40毫秒刷新，实现毫秒级动效
        // 每 10 分钟自动重新校准一次授时
        setInterval(syncNetworkTime, 500000); 
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTimeWidget);
    } else {
        initTimeWidget();
    }
})();