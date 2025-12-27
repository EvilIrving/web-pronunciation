/**
 * 欧路词典解析器
 * 从 dict.eudic.net 返回的 HTML 中提取音标和音频 URL
 *
 * 输出格式与有道相同：
 * - ipa_us/ipa_uk: 美/英音音标
 * - audio_url_us/audio_url_uk: 完整音频 URL（使用 frdic TTS）
 */

const EUDIC_API_BASE = 'https://dict.eudic.net/dicts';
const FRDIC_URL = 'https://api.frdic.com/api/v2/speech/speakweb';

interface EudicResult {
  word: string;
  ipa_us: string | null;
  ipa_uk: string | null;
  ipa: string | null;
  audio_url_us: string | null;
  audio_url_uk: string | null;
  audio_url: string | null;
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
function parseVoiceParams(dataRel: string): { langid: string; voicename: string; txt: string } | null {
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
 * 从 voice params 构建 frdic 音频 URL
 */
function buildAudioUrl(voiceParams: { langid: string; voicename: string; txt: string }): string {
  return `${FRDIC_URL}?langid=${voiceParams.langid}&voicename=${voiceParams.voicename}&txt=${voiceParams.txt}`;
}

/**
 * 解析欧路词典 HTML 响应
 */
export function parseEudicResponse(html: string, word: string): EudicResult {
  // 英式发音块
  const ukBlockMatch = html.match(
    /data-rel="([^"]*voicename=en_uk_male[^"]*)"[^>]*><span class="phontype">英<\/span><span class="Phonitic">([^<]+)<\/span>/
  );

  // 美式发音块
  const usBlockMatch = html.match(
    /data-rel="([^"]*voicename=en_us_female[^"]*)"[^>]*><span class="phontype">美<\/span><span class="Phonitic">([^<]+)<\/span>/
  );

  // 备用：查找所有 Phonitic 标签（按顺序：英式、美式）
  const allPhoneticMatches = [...html.matchAll(/<span class="Phonitic">\/([^<]+)\/<\/span>/g)];

  // 提取音标
  const ipaUk = ukBlockMatch ? cleanIPA(ukBlockMatch[2]) :
                (allPhoneticMatches[0]?.[1] ? cleanIPA(allPhoneticMatches[0][1]) : null);
  const ipaUs = usBlockMatch ? cleanIPA(usBlockMatch[2]) :
                (allPhoneticMatches[1]?.[1] ? cleanIPA(allPhoneticMatches[1][1]) : null);

  // 提取发音参数并构建音频 URL
  let audio_url_uk: string | null = null;
  let audio_url_us: string | null = null;

  if (ukBlockMatch) {
    const voiceParams = parseVoiceParams(ukBlockMatch[1]);
    if (voiceParams) {
      audio_url_uk = buildAudioUrl(voiceParams);
    }
  }

  if (usBlockMatch) {
    const voiceParams = parseVoiceParams(usBlockMatch[1]);
    if (voiceParams) {
      audio_url_us = buildAudioUrl(voiceParams);
    }
  }

  console.log(`[Eudic] Parsed: word="${word}", ipa_uk=${ipaUk}, ipa_us=${ipaUs}, audio_uk=${!!audio_url_uk}, audio_us=${!!audio_url_us}`);

  return {
    word: word.toLowerCase(),
    ipa_us: ipaUs,
    ipa_uk: ipaUk,
    ipa: null,  // 欧陆不提供通用音标
    audio_url_us: audio_url_us,
    audio_url_uk: audio_url_uk,
    audio_url: null,
  };
}

/**
 * 获取欧路词典页面
 */
export async function fetchEudicPage(word: string): Promise<string> {
  const url = `${EUDIC_API_BASE}/MiniDictSearch2?word=${encodeURIComponent(word)}`;
  console.log(`[Eudic] Fetch: ${url}`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Eudic: ${res.status}`);
  }

  const html = await res.text();
  console.log(`[Eudic] Received: ${html.length} chars`);
  return html;
}

/**
 * 获取单词音标和音频（从欧路词典）
 */
export async function getPhonetics(word: string): Promise<EudicResult> {
  const html = await fetchEudicPage(word);
  return parseEudicResponse(html, word);
}
