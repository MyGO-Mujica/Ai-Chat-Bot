/**
 * 🌤️ 天气查询工具 - 接入真实 API
 *
 * API 提供商：uapis.cn
 * 支持：实时天气、多天预报、逐小时预报、生活指数等
 */

/**
 * 获取指定城市的天气信息
 * @param {string} city - 城市名称（支持中文和英文）
 * @param {object} options - 可选参数
 * @param {boolean} options.extended - 是否返回扩展字段（体感温度、能见度、气压、空气质量等）
 * @param {boolean} options.forecast - 是否返回多天预报（最多7天）
 * @returns {object} 天气数据
 */
export async function getWeather(city, options = {}) {
  console.log(
    `🔧 [工具调用] getWeather("${city}", ${JSON.stringify(options)})`,
  );

  try {
    // 构建请求 URL
    const params = new URLSearchParams({
      city,
      extended: options.extended || false,
      forecast: options.forecast || false,
    });

    const url = `https://uapis.cn/api/v1/misc/weather?${params}`;

    // 调用真实 API
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || `查询失败：${response.status}`,
      };
    }

    // 格式化返回数据，只返回关键信息
    return {
      success: true,
      city: data.city,
      province: data.province,
      weather: data.weather,
      temperature: data.temperature,
      feels_like: data.feels_like,
      humidity: data.humidity,
      wind_direction: data.wind_direction,
      wind_power: data.wind_power,
      report_time: data.report_time,
      // 如果有扩展字段
      ...(data.aqi && {
        aqi: data.aqi,
        aqi_category: data.aqi_category,
        visibility: data.visibility,
        pressure: data.pressure,
        uv: data.uv,
      }),
      // 如果有预报数据
      ...(data.forecast && {
        forecast: data.forecast.slice(0, 3).map((day) => ({
          date: day.date,
          weather: day.text_day,
          temp_max: day.temp_max,
          temp_min: day.temp_min,
        })),
      }),
    };
  } catch (error) {
    console.error("❌ 天气 API 调用失败:", error.message);
    return {
      success: false,
      message: `网络错误：${error.message}`,
    };
  }
}
