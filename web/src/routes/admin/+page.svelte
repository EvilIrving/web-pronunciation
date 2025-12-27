<script lang="ts">
  // @ts-nocheck
  import type { Word } from '$lib/types';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authState, signOut, initAuth } from '$lib/auth.svelte';
  import { supabase } from '$lib/supabase';
  import { browser } from '$app/environment';

  // 从服务端获取的 session
  let { data } = $props<{ data: { session: any } }>();

  // 状态
  let words = $state<Word[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let isAuthenticated = $state(false);
  let authLoading = $state(true);

  // 批量导入
  let showBatchModal = $state(false);
  let batchText = $state('');
  let batchLoading = $state(false);
  let batchProgress = $state<{ current: number; total: number; word: string } | null>(null);
  let batchResult = $state<{ success: number; failed: string[] } | null>(null);

  // 搜索
  let searchQuery = $state('');

  // 快速添加
  let quickAddWord = $state('');
  let quickAddLoading = $state(false);
  let quickAddError = $state<string | null>(null);

  // 音频更新状态（按行跟踪）
  let refreshingWordId = $state<string | null>(null);

  // 音频上传状态（按行跟踪）
  let uploadingAudioId = $state<string | null>(null);

  // 隐藏的文件输入元素
  let fileInputRef = $state<HTMLInputElement | null>(null);
  let pendingUploadWord = $state<Word | null>(null);

  // 音频播放（合并 US/UK）
  let playingAudio = $state<{ id: string; type: 'us' | 'uk' } | null>(null);
  let audioRef = $state<HTMLAudioElement | null>(null);

  // Toast
  let toastMessage = $state('');
  let toastType = $state<'success' | 'error' | 'info'>('success');
  let toastVisible = $state(false);
  let toastTimer: ReturnType<typeof setTimeout>;

  // LLM 模型选择
  let selectedModel = $state<'kimi' | 'minimax'>('kimi');
  let availableModels = $state<Array<{ id: string; name: string; modelId: string; provider: string }>>([]);
  let modelsLoading = $state(true);

  // 计算过滤后的词汇列表
  let filteredWords = $derived.by(() => {
    let result = words;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (w) => w.word.toLowerCase().includes(query) || w.normalized.includes(query)
      );
    }
    return result;
  });

  // 初始化认证并检查登录状态
  onMount(() => {
    // 从 localStorage 恢复认证状态
    if (browser) {
      const savedUser = localStorage.getItem('auth_user');
      if (savedUser) {
        try {
          authState.user = JSON.parse(savedUser);
          authState.loading = false;
        } catch (e) {
          console.error('解析保存的用户信息失败:', e);
        }
      }
    }

    // 初始化 Supabase 认证监听
    initAuth();

    // 延迟检查认证状态
    setTimeout(() => {
      // 如果本地存储有用户，或者 Supabase 会话有效
      if (authState.user) {
        isAuthenticated = true;
        loadWords();
        loadModels();
      } else {
        // 尝试获取 Supabase 会话
        const checkSession = async () => {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            authState.user = data.session.user;
            authState.session = data.session;
            isAuthenticated = true;
            loadWords();
            loadModels();
          } else {
            goto('/login');
          }
          authLoading = false;
        };
        checkSession();
        return;
      }
      authLoading = false;
    }, 500);
  });

  // 退出登录
  async function handleSignOut() {
    await signOut();
    goto('/');
  }

  // 加载支持的模型列表
  async function loadModels() {
    try {
      const response = await fetch('/api/ipa');
      const result = await response.json();
      if (response.ok && result.models) {
        availableModels = result.models;
        selectedModel = result.defaultModel as 'kimi' | 'minimax';
      }
    } catch (e) {
      console.warn('加载模型列表失败:', e);
    } finally {
      modelsLoading = false;
    }
  }

  // 加载词汇列表
  async function loadWords() {
    loading = true;
    error = null;
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      // 获取所有数据（不使用分页）
      params.set('limit', '10000');

      const response = await fetch(`/api/words?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '加载失败');
      }
      words = result.data || [];
    } catch (e) {
      error = e instanceof Error ? e.message : '加载失败';
    } finally {
      loading = false;
    }
  }

  // 调用 IPA API 生成音标
  async function fetchIPA(word: string): Promise<{ ipa: string; ipa_uk: string }> {
    const response = await fetch('/api/ipa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, provider: selectedModel }),
    });

    if (!response.ok) {
      throw new Error(`IPA API error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '生成 IPA 失败');
    }

    return { ipa: result.ipa || '', ipa_uk: result.ipa_uk || '' };
  }

  // 调用 Eudic API（仅获取音标）
  async function fetchEudic(word: string) {
    const res = await fetch(`/api/eudic?word=${encodeURIComponent(word)}`);
    if (!res.ok) throw new Error('Eudic API 错误');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '获取失败');
    return {
      ipa_us: data.ipa_us || '',
      ipa_uk: data.ipa_uk || '',
    };
  }

  // 调用 TTS API 生成音频（支持 mode: 'both' 同时生成美音和英音）
  async function fetchTTS(word: string, mode: 'single' | 'both' = 'single', accent: 'us' | 'uk' = 'us'): Promise<{ audio_url: string; audio_url_uk?: string }> {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, mode, accent }),
    });
    if (!res.ok) throw new Error('TTS 错误');
    const data = await res.json();
    return {
      audio_url: data.audio_url || '',
      audio_url_uk: data.audio_url_uk || '',
    };
  }

  // 快速添加单词
  async function quickAdd() {
    const word = quickAddWord.trim();
    if (!word) return;

    quickAddWord = '';
    quickAddError = null;
    quickAddLoading = true;

    const tempId = `temp-${Date.now()}`;
    const optimisticWord: Word = {
      id: tempId,
      word,
      ipa: null,
      audio_url: null,
      ipa_uk: null,
      audio_url_uk: null,
      normalized: word.toLowerCase(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    words = [optimisticWord, ...words];
    showToast(`正在添加「${word}」...`, 'info');

    try {
      const eudic = await fetchEudic(word).catch(() => ({ ipa_us: '', ipa_uk: '' }));
      // 音频通过 TTS API 获取（mode: 'both' 同时生成美音和英音）
      const tts = await fetchTTS(word, 'both').catch(() => ({ audio_url: '', audio_url_uk: '' }));

      const response = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          ipa: eudic.ipa_us || eudic.ipa_uk,
          ipa_uk: eudic.ipa_uk,
          audio_url: tts.audio_url,
          audio_url_uk: tts.audio_url_uk,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '保存失败');

      words = words.map(w => w.id === tempId ? { ...w, ...result.data } : w);
      showToast(`已添加「${word}」`, 'success');
    } catch (e) {
      words = words.filter(w => w.id !== tempId);
      quickAddError = e instanceof Error ? e.message : '保存失败';
      showToast(quickAddError, 'error');
    } finally {
      quickAddLoading = false;
    }
  }

  // 刷新单词：重新获取最新的音标和音频
  async function refreshWord(word: Word) {
    refreshingWordId = word.id;
    const original = { ...word };
    words = words.map(w => w.id === word.id ? { ...w, ipa: '', ipa_uk: '', audio_url: '', audio_url_uk: '' } : w);
    showToast(`正在刷新「${word.word}」...`, 'info');

    try {
      console.log(`[Refresh] Starting for word: ${word.word}`);
      // 音标从 Eudic 获取
      const eudic = await fetchEudic(word.word).catch(() => ({ ipa_us: '', ipa_uk: '' }));
      // 音频通过 TTS API 获取（mode: 'both' 同时生成美音和英音）
      const tts = await fetchTTS(word.word, 'both').catch(() => ({ audio_url: '', audio_url_uk: '' }));
      console.log(`[Refresh] TTS result: audio_url="${tts.audio_url}", audio_url_uk="${tts.audio_url_uk}"`);

      if (!eudic.ipa_us && !eudic.ipa_uk && !tts.audio_url && !tts.audio_url_uk) {
        words = words.map(w => w.id === word.id ? original : w);
        showToast('刷新失败', 'error');
        refreshingWordId = null;
        return;
      }

      const response = await fetch('/api/words', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: word.id,
          ipa: eudic.ipa_us || eudic.ipa_uk,
          ipa_uk: eudic.ipa_uk,
          audio_url: tts.audio_url,
          audio_url_uk: tts.audio_url_uk,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '更新失败');

      words = words.map(w => w.id === word.id ? { ...w, ...result.data } : w);
      showToast(`已刷新「${word.word}」`, 'success');
    } catch (e) {
      words = words.map(w => w.id === word.id ? original : w);
      showToast('刷新失败', 'error');
    } finally {
      refreshingWordId = null;
    }
  }

  // 乐观删除
  async function deleteWord(word: Word) {
    words = words.filter(w => w.id !== word.id);
    showToast(`已删除「${word.word}」`, 'success');

    fetch(`/api/words?id=${word.id}`, { method: 'DELETE' }).catch(() => {
      words = [...words, word];
      showToast('删除失败，已恢复', 'error');
    });
  }

  // 显示 Toast
  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    toastMessage = message;
    toastType = type;
    toastVisible = true;
    
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastVisible = false;
    }, 5000);
  }

  // 隐藏 Toast
  function hideToast() {
    toastVisible = false;
  }

  // 键盘快捷键
  function handleKeydown(_event: KeyboardEvent) {
    // 预留
  }

  // 播放音频（合并 US/UK）
  function playAudio(word: Word, type: 'us' | 'uk') {
    const url = type === 'us' ? word.audio_url : word.audio_url_uk;
    if (!url) return;

    if (playingAudio?.id === word.id && playingAudio?.type === type) {
      audioRef?.pause();
      playingAudio = null;
    } else {
      playingAudio = { id: word.id, type };
      setTimeout(() => audioRef?.play().catch(() => (playingAudio = null)), 50);
    }
  }

  function getPlayingAudioUrl() {
    if (!playingAudio) return '';
    const w = words.find(w => w.id === playingAudio!.id);
    return playingAudio.type === 'us' ? w?.audio_url : w?.audio_url_uk;
  }

  function onAudioEnded() {
    playingAudio = null;
  }

  // 批量导入
  async function importBatch() {
    const lines = batchText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);
    if (lines.length === 0) {
      alert('请输入要导入的单词');
      return;
    }

    batchLoading = true;
    batchResult = null;
    batchProgress = null;
    let success = 0;
    const failed: string[] = [];

    // 1. 乐观更新：立即将所有单词添加到列表顶部
    const optimisticWords: Word[] = lines.map((word, i) => ({
      id: `temp-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      word,
      ipa: null,
      audio_url: null,
      ipa_uk: null,
      audio_url_uk: null,
      normalized: word.toLowerCase(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    words = [...optimisticWords, ...words];

    for (let i = 0; i < lines.length; i++) {
      const word = lines[i];
      const tempId = optimisticWords[i].id;
      batchProgress = { current: i + 1, total: lines.length, word };

      try {
        console.log(`[Batch] Processing word ${i + 1}/${lines.length}: ${word}`);
        // 音标从 Eudic 获取
        const eudic = await fetchEudic(word).catch(() => ({ ipa_us: '', ipa_uk: '' }));
        // 音频通过 TTS API 获取
        const tts = await fetchTTS(word, 'both').catch(() => ({ audio_url: '', audio_url_uk: '' }));
        console.log(`[Batch] TTS result for ${word}: audio_url="${tts.audio_url}", audio_url_uk="${tts.audio_url_uk}"`);

        const response = await fetch('/api/words', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word,
            ipa: eudic.ipa_us || eudic.ipa_uk,
            ipa_uk: eudic.ipa_uk,
            audio_url: tts.audio_url,
            audio_url_uk: tts.audio_url_uk,
          }),
        });
        const result = await response.json();

        if (!response.ok) {
          failed.push(`${word}: ${result.error || '未知错误'}`);
          words = words.filter(w => w.id !== tempId);
        } else {
          success++;
          words = words.map(w => w.id === tempId ? { ...w, ...result.data } : w);
        }
      } catch (e) {
        failed.push(`${word}: ${e instanceof Error ? e.message : '未知错误'}`);
        words = words.filter(w => w.id !== tempId);
      }

      if (i < lines.length - 1) {
        // 速率限制：3秒/请求，避免外部 API 被封
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    batchResult = { success, failed };
    batchLoading = false;
    batchProgress = null;

    if (success > 0) {
      showToast(`成功导入 ${success} 个单词`, 'success');
    }
    if (failed.length > 0) {
      showToast(`导入失败 ${failed.length} 个单词`, 'error');
    }
  }

  // 关闭批量导入 Modal
  function closeBatchModal() {
    showBatchModal = false;
    batchText = '';
    batchResult = null;
    batchProgress = null;
  }

  // 音频上传 Modal 状态
  let showUploadModal = $state(false);
  let uploadMode = $state<'file' | 'url'>('url');
  let uploadUrl = $state('');
  let uploadLoading = $state(false);
  let uploadError = $state<string | null>(null);
  let uploadWord = $state<Word | null>(null);

  // 打开音频上传 Modal
  function openUploadModal(word: Word) {
    uploadWord = word;
    uploadMode = 'url';
    uploadUrl = '';
    uploadError = null;
    showUploadModal = true;
  }

  // 关闭音频上传 Modal
  function closeUploadModal() {
    showUploadModal = false;
    uploadWord = null;
    uploadUrl = '';
    uploadError = null;
  }

  // 通过 URL 上传音频
  async function uploadAudioByUrl() {
    const url = uploadUrl.trim();
    if (!url) {
      uploadError = '请输入音频 URL';
      return;
    }

    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      uploadError = '无效的 URL 格式';
      return;
    }

    if (!uploadWord) return;

    // 保存上传信息到局部变量（在调用 closeUploadModal 之前）
    const uploadWordId = uploadWord.id;
    const uploadWordText = uploadWord.word;
    const originalAudioUrl = uploadWord.audio_url;

    uploadLoading = true;
    uploadError = null;

    // 1. 乐观更新：立即清空音频 URL
    words = words.map(w => w.id === uploadWordId ? { ...w, audio_url: '' } : w);
    showToast(`正在上传「${uploadWordText}」音频...`, 'info');
    closeUploadModal();

    try {
      const response = await fetch('/api/upload-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, word: uploadWordText }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '上传失败');
      }

      // 更新数据库中的音频URL
      const updateResponse = await fetch('/api/words', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: uploadWordId, audio_url: result.audio_url }),
      });

      const updateResult = await updateResponse.json();

      if (!updateResponse.ok) {
        throw new Error(updateResult.error || '更新音频失败');
      }

      // 成功：更新音频 URL
      words = words.map(w => w.id === uploadWordId ? { ...w, audio_url: result.audio_url } : w);
      showToast(`已上传「${uploadWordText}」音频`, 'success');
    } catch (e) {
      // 失败：恢复原音频 URL
      words = words.map(w => w.id === uploadWordId ? { ...w, audio_url: originalAudioUrl } : w);
      showToast(e instanceof Error ? e.message : '上传失败', 'error');
    } finally {
      uploadLoading = false;
    }
  }

  // 触发文件选择
  function triggerUploadFile(word: Word) {
    pendingUploadWord = word;
    if (fileInputRef) {
      fileInputRef.click();
    }
  }

  // 处理文件选择
  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    // 获取上传的单词对象
    const wordToUpload = pendingUploadWord;
    if (!file || !wordToUpload) {
      return;
    }

    // 保存上传信息到局部变量
    const pendingWordId = wordToUpload.id;
    const pendingWordText = wordToUpload.word;
    const originalAudioUrl = wordToUpload.audio_url;

    uploadingAudioId = pendingWordId;

    // 1. 乐观更新：立即清空音频 URL
    words = words.map(w => w.id === pendingWordId ? { ...w, audio_url: '' } : w);
    showToast(`正在上传「${pendingWordText}」音频...`, 'info');
    
    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('word', pendingWordText);

      const response = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '上传失败');
      }

      // 更新数据库中的音频URL
      const updateResponse = await fetch('/api/words', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pendingWordId, audio_url: result.audio_url }),
      });

      const updateResult = await updateResponse.json();

      if (!updateResponse.ok) {
        throw new Error(updateResult.error || '更新音频失败');
      }

      // 成功：更新音频 URL
      words = words.map(w => w.id === pendingWordId ? { ...w, audio_url: result.audio_url } : w);
      showToast(`已上传「${pendingWordText}」音频`, 'success');
    } catch (e) {
      // 失败：恢复原音频 URL
      words = words.map(w => w.id === pendingWordId ? { ...w, audio_url: originalAudioUrl } : w);
      showToast(e instanceof Error ? e.message : '上传失败', 'error');
    } finally {
      uploadingAudioId = null;
      pendingUploadWord = null;
      if (fileInputRef) {
        fileInputRef.value = ''; // 重置输入
      }
    }
  }

  // 全量更新：从 Eudic 获取所有缺失的音标和音频
  async function fullUpdate() {
    if (words.length === 0) {
      showToast('没有词汇数据', 'error');
      return;
    }

    loading = true;
    let updated = 0;
    let failed = 0;
    showToast('开始全量更新...', 'info');

    for (const word of words) {
      try {
        if (word.ipa_uk && word.audio_url_uk) continue;

        const eudic = await fetchEudic(word.word).catch(() => ({ ipa_us: '', ipa_uk: '', audio_url_us: '', audio_url_uk: '' }));
        const updateData: Record<string, string> = { id: word.id };

        if (!word.ipa_uk && eudic.ipa_uk) {
          updateData.ipa_uk = eudic.ipa_uk;
          if (!word.ipa) updateData.ipa = eudic.ipa_us || eudic.ipa_uk;
        }
        if (!word.audio_url_uk && eudic.audio_url_uk) {
          updateData.audio_url_uk = eudic.audio_url_uk;
        }

        if (Object.keys(updateData).length > 1) {
          const response = await fetch('/api/words', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
          });
          if (response.ok) {
            const data = await response.json();
            words = words.map(w => w.id === word.id ? { ...w, ...data.data } : w);
            updated++;
          } else {
            failed++;
          }
        }
      } catch {
        failed++;
      }
      // 速率限制：3秒/请求，避免外部 API 被封
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    loading = false;
    showToast(`全量更新完成：成功 ${updated}，失败 ${failed}`, 'success');
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>后台管理 - 词汇管理</title>
</svelte:head>

<!-- Snippets -->
{#snippet playIcon(isPlaying: boolean)}
  {#if isPlaying}
    <svg class="h-5 w-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  {:else}
    <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  {/if}
{/snippet}

{#snippet toastIcon(type: 'success' | 'error' | 'info')}
  {#if type === 'success'}
    <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
    </svg>
  {:else if type === 'error'}
    <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  {:else}
    <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  {/if}
{/snippet}

{#snippet centerMessage(text: string)}
  <div class="flex min-h-screen items-center justify-center bg-gray-100">
    <div class="text-gray-500">{text}</div>
  </div>
{/snippet}

{#snippet ipaCell(word: Word, type: 'us' | 'uk')}
  {@const ipa = type === 'us' ? word.ipa : word.ipa_uk}
  {@const url = type === 'us' ? word.audio_url : word.audio_url_uk}
  {@const isPlaying = playingAudio?.id === word.id && playingAudio?.type === type}
  {@const hasAudio = !!url}
  {@const baseColor = type === 'us' ? 'text-blue-600' : 'text-green-600'}
  {@const hoverColor = type === 'us' ? 'hover:text-blue-800 hover:bg-blue-50' : 'hover:text-green-800 hover:bg-green-50'}
  {#if ipa}
    {#if hasAudio}
      <button
        onclick={() => playAudio(word, type)}
        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors cursor-pointer {baseColor} {hoverColor} {isPlaying ? 'bg-opacity-20 animate-pulse' : ''}"
        title="点击播放"
      >
        <span>{ipa}</span>
        {#if isPlaying}
          <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        {/if}
      </button>
    {:else}
      <span class="text-gray-400 px-1.5 py-0.5" title="无音频">{ipa}</span>
    {/if}
  {:else}
    <span class="text-gray-300">-</span>
  {/if}
{/snippet}

{#if authLoading}
  {@render centerMessage('检查登录状态...')}
{:else if !isAuthenticated}
  {@render centerMessage('正在重定向到登录页...')}
{:else}
  <div class="min-h-screen bg-gray-100">
    <!-- Toast 通知 -->
    {#if toastVisible}
      <div class="fixed bottom-6 right-6 z-50 animate-fade-in">
        <div class="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-lg border
                    {toastType === 'success' ? 'border-green-200' : toastType === 'error' ? 'border-red-200' : 'border-blue-200'}">
          {@render toastIcon(toastType)}
          <span class="text-sm text-gray-700 font-medium">{toastMessage}</span>
          <button
            onclick={hideToast}
            class="ml-1 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="关闭通知"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- 顶部导航 -->
    <header class="bg-white shadow">
      <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-bold text-gray-900">词汇管理后台</h1>
          <div class="flex items-center gap-4">
            <!-- 用户信息 -->
            <span class="text-sm text-gray-600">
              {authState.user?.email || '用户'}
            </span>
            <!-- 退出按钮 -->
            <button
              onclick={handleSignOut}
              class="rounded-md bg-gray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              退出
            </button>
            <!-- 模型选择器 -->
            <div class="flex items-center gap-2">
              <label for="model-select" class="text-sm text-gray-600">模型:</label>
              <select
                id="model-select"
                bind:value={selectedModel}
                disabled={modelsLoading}
                class="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {#if modelsLoading}
                  <option>加载中...</option>
                {:else}
                  {#each availableModels as model (model.id)}
                    <option value={model.id}>{model.name}</option>
                  {/each}
                {/if}
              </select>
            </div>
            <button
              onclick={() => (showBatchModal = true)}
              class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              批量导入
            </button>
            <button
              onclick={fullUpdate}
              disabled={loading}
              class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? '更新中...' : '全量更新'}
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <!-- 快速添加 -->
      <div class="mb-4">
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="快速添加单词（输入后按 Enter）..."
            bind:value={quickAddWord}
            onkeydown={(e) => e.key === 'Enter' && quickAdd()}
            disabled={quickAddLoading}
            class="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onclick={quickAdd}
            disabled={quickAddLoading}
            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {quickAddLoading ? '保存中...' : '添加'}
          </button>
        </div>
        {#if quickAddError}
          <p class="mt-1 text-sm text-red-600">{quickAddError}</p>
        {/if}
      </div>

      <!-- 搜索框 -->
      <div class="mb-4">
        <input
          type="text"
          placeholder="搜索词汇..."
          bind:value={searchQuery}
          class="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:max-w-md"
        />
      </div>

      <!-- 统计信息 -->
      <div class="mb-4 text-sm text-gray-600">
        共 {filteredWords.length} 条记录
        {#if filteredWords.length !== words.length}
          （总计 {words.length} 条）
        {/if}
      </div>

      <!-- 词汇列表 -->
      {#if loading}
        <div class="py-12 text-center text-gray-500">加载中...</div>
      {:else if error}
        <div class="py-12 text-center text-red-500">{error}</div>
      {:else if filteredWords.length === 0}
        <div class="py-12 text-center text-gray-500">暂无数据</div>
      {:else}
        <div class="overflow-x-auto rounded-lg bg-white shadow">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  单词
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  美音
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  英音
                </th>
                <th class="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
              {#each filteredWords as word (word.id)}
                <tr class="hover:bg-gray-50">
                  <!-- 单词列 -->
                  <td class="whitespace-nowrap px-4 py-3">
                    <span class="font-medium text-gray-900">{word.word}</span>
                  </td>

                  <!-- 美音列（音标+发音） -->
                  <td class="whitespace-nowrap px-4 py-3 text-sm">
                    {@render ipaCell(word, 'us')}
                  </td>

                  <!-- 英音列（音标+发音） -->
                  <td class="whitespace-nowrap px-4 py-3 text-sm">
                    {@render ipaCell(word, 'uk')}
                  </td>

                  <!-- 操作列 -->
                  <td class="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <button
                      onclick={() => refreshWord(word)}
                      disabled={refreshingWordId === word.id || uploadingAudioId === word.id}
                      class="mr-2 text-purple-600 hover:text-purple-800 disabled:opacity-50"
                      title="刷新音标和音频"
                    >
                      {refreshingWordId === word.id ? '刷新中...' : '更新'}
                    </button>
                    <button
                      onclick={() => openUploadModal(word)}
                      disabled={uploadingAudioId === word.id}
                      class="mr-2 text-orange-600 hover:text-orange-800 disabled:opacity-50"
                      title="上传自定义音频"
                    >
                      {uploadingAudioId === word.id ? '上传中...' : '上传'}
                    </button>
                    <button onclick={() => deleteWord(word)} class="text-red-600 hover:text-red-800">
                      删除
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </main>

    <!-- 音频元素 -->
    <audio
      bind:this={audioRef}
      onended={onAudioEnded}
      src={getPlayingAudioUrl() || ''}
      preload="none"
    ></audio>

    <!-- 隐藏的文件输入元素 -->
    <input
      type="file"
      accept="audio/mp3,audio/mpeg,audio/wav,audio/webm,audio/ogg"
      bind:this={fileInputRef}
      onchange={handleFileSelect}
      class="hidden"
    />

    <!-- 批量导入 Modal -->
    {#if showBatchModal}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div class="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
          <h2 class="mb-4 text-lg font-bold">批量导入词汇</h2>
          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-sm font-medium text-gray-700" for="batch-words">
                输入单词 (每行一个)
              </label>
              <textarea
                id="batch-words"
                bind:value={batchText}
                rows="10"
                placeholder="coroutine&#10;async&#10;await&#10;suspend&#10;..."
                class="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              ></textarea>
            </div>

            {#if batchProgress}
              <div class="rounded-md border border-blue-200 bg-blue-50 p-3">
                <div class="mb-2 flex items-center justify-between text-sm">
                  <span class="text-blue-700">正在导入: {batchProgress.word}</span>
                  <span class="font-medium text-blue-900">{batchProgress.current}/{batchProgress.total}</span>
                </div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-blue-200">
                  <div
                    class="h-full bg-blue-600 transition-all duration-300"
                    style="width: {(batchProgress.current / batchProgress.total) * 100}%"
                  ></div>
                </div>
              </div>
            {/if}

            {#if batchResult}
              <div class="rounded-md border p-3 {batchResult.failed.length > 0 ? 'border-yellow-300 bg-yellow-50' : 'border-green-300 bg-green-50'}">
                <p class="font-medium">
                  成功导入 {batchResult.success} 条
                  {#if batchResult.failed.length > 0}
                    ，失败 {batchResult.failed.length} 条
                  {/if}
                </p>
                {#if batchResult.failed.length > 0}
                  <ul class="mt-2 max-h-32 overflow-y-auto text-sm text-red-600">
                    {#each batchResult.failed as err, i (i)}
                      <li>{err}</li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}

            <div class="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onclick={closeBatchModal}
                class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                关闭
              </button>
              <button
                type="button"
                onclick={importBatch}
                disabled={batchLoading}
                class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {batchLoading ? '导入中...' : '开始导入'}
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- 音频上传 Modal -->
    {#if showUploadModal}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h2 class="mb-4 text-lg font-bold">上传自定义音频</h2>
          <p class="mb-4 text-sm text-gray-600">
            为「<span class="font-medium">{uploadWord?.word}</span>」上传自定义发音
          </p>
          
          <!-- 模式切换 -->
          <div class="mb-4 flex gap-2">
            <button
              onclick={() => uploadMode = 'url'}
              class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors
                     {uploadMode === 'url' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            >
              🔗 链接
            </button>
            <button
              onclick={() => uploadMode = 'file'}
              class="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors
                     {uploadMode === 'file' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            >
              📁 文件
            </button>
          </div>
          
          {#if uploadMode === 'url'}
            <!-- URL 输入模式 -->
            <div class="space-y-4">
              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700" for="audio-url">
                  音频链接
                </label>
                <input
                  id="audio-url"
                  type="url"
                  bind:value={uploadUrl}
                  placeholder="https://..."
                  class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <p class="mt-1 text-xs text-gray-500">支持 MP3、WAV、WebM、OGG 格式的音频链接</p>
              </div>
              
              {#if uploadError}
                <p class="text-sm text-red-600">{uploadError}</p>
              {/if}
              
              <div class="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onclick={closeUploadModal}
                  class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onclick={uploadAudioByUrl}
                  disabled={uploadLoading}
                  class="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {uploadLoading ? '上传中...' : '确认上传'}
                </button>
              </div>
            </div>
          {:else}
            <!-- 文件上传模式 -->
            <div class="space-y-4">
              <div class="rounded-md border-2 border-dashed border-gray-300 p-6 text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p class="mt-2 text-sm text-gray-600">点击选择音频文件</p>
                <p class="mt-1 text-xs text-gray-500">支持 MP3、WAV、WebM、OGG（最大 10MB）</p>
                <button
                  type="button"
                  onclick={() => uploadWord && triggerUploadFile(uploadWord)}
                  class="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  选择文件
                </button>
              </div>
              
              <div class="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onclick={closeUploadModal}
                  class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Toast 动画 */
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
</style>

