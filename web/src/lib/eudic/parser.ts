/**
 * 欧路词典 HTML 解析器
 * 从 dict.eudic.net 返回的 HTML 中提取音标和音频 URL
 */

// 欧路词典 API 基础 URL
const EUDIC_API_BASE = 'https://dict.eudic.net/dicts';

/**
 * 发音参数（从 data-rel 提取）
 */
export interface VoiceParams {
  langid: string;
  voicename: string;
  txt: string;  // 已编码的文本，可直接用于 frdic API
}

/**
 * 欧路词典解析结果
 */
export interface EudicParsedData {
  word: string;
  ipa_uk: string | null;
  ipa_us: string | null;
  voice_uk: VoiceParams | null;  // 英式发音参数
  voice_us: VoiceParams | null;  // 美式发音参数
}

/**
 * 清理音标字符串
 */
function cleanIPA(ipa: string): string {
  return ipa.trim().replace(/[/\\]/g, '');
}

/**
 * 从 data-rel 属性解析发音参数
 * data-rel="langid=en&amp;voicename=en_uk_male&amp;txt=QYNYmV0YQ%3d%3d"
 */
function parseVoiceParams(dataRel: string): VoiceParams | null {
  // HTML 实体解码 &amp; -> &
  const decoded = dataRel.replace(/&amp;/g, '&');
  const params = new URLSearchParams(decoded);
  
  const langid = params.get('langid');
  const voicename = params.get('voicename');
  const txt = params.get('txt');
  
  if (langid && voicename && txt) {
    return { langid, voicename, txt };
  }
  return null;
}

/**
 * 解析欧路词典 HTML 响应
 * 提取音标和发音参数（可直接用于 frdic TTS API）
 */
export function parseEudicResponse(html: string, word: string): EudicParsedData {
  // 解析英式发音块：data-rel + 音标
  const ukBlockMatch = html.match(
    /data-rel="([^"]*voicename=en_uk_male[^"]*)"[^>]*><span class="phontype">英<\/span><span class="Phonitic">([^<]+)<\/span>/
  );

  // 解析美式发音块：data-rel + 音标
  const usBlockMatch = html.match(
    /data-rel="([^"]*voicename=en_us_female[^"]*)"[^>]*><span class="phontype">美<\/span><span class="Phonitic">([^<]+)<\/span>/
  );

  // 备用方法：直接查找所有 Phonitic 标签（按顺序：英式、美式）
  const allPhoneticMatches = [...html.matchAll(/<span class="Phonitic">\/([^<]+)\/<\/span>/g)];

  // 提取音标
  const ipaUk = ukBlockMatch ? cleanIPA(ukBlockMatch[2]) :
                (allPhoneticMatches[0] ? cleanIPA(allPhoneticMatches[0][1]) : null);
  const ipaUs = usBlockMatch ? cleanIPA(usBlockMatch[2]) :
                (allPhoneticMatches[1] ? cleanIPA(allPhoneticMatches[1][1]) : null);

  // 提取发音参数
  const voiceUk = ukBlockMatch ? parseVoiceParams(ukBlockMatch[1]) : null;
  const voiceUs = usBlockMatch ? parseVoiceParams(usBlockMatch[1]) : null;

  console.log(`[Eudic] Parsed IPA: UK=${ipaUk}, US=${ipaUs}`);
  console.log(`[Eudic] Voice params: UK=${voiceUk?.txt || 'none'}, US=${voiceUs?.txt || 'none'}`);

  return {
    word: word.toLowerCase(),
    ipa_uk: ipaUk,
    ipa_us: ipaUs,
    voice_uk: voiceUk,
    voice_us: voiceUs,
  };
}

/**
 * 获取欧路词典页面
 */
export async function fetchEudicPage(word: string): Promise<string> {
  const url = `${EUDIC_API_BASE}/MiniDictSearch2?word=${encodeURIComponent(word)}`;

  console.log(`[Eudic] Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Eudic API error: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  console.log(`[Eudic] HTML received: ${html.length} characters`);

  return html;
}

/**
 * 获取单词音标（从欧路词典）
 */
export async function getPhonetics(word: string): Promise<EudicParsedData> {
  const html = await fetchEudicPage(word);
  return parseEudicResponse(html, word);
}
