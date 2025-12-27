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
    if (!data.success) throw new Error(data.error || 'unknown error');
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
    showToast(`adding "${word}"...`, 'info');

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
      showToast(`added "${word}"`, 'success');
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
    showToast(`refreshing "${word.word}"...`, 'info');

    try {
      console.log(`[Refresh] Starting for word: ${word.word}`);
      // 音标从 Eudic 获取
      const eudic = await fetchEudic(word.word).catch(() => ({ ipa_us: '', ipa_uk: '' }));
      // 音频通过 TTS API 获取（mode: 'both' 同时生成美音和英音）
      const tts = await fetchTTS(word.word, 'both').catch(() => ({ audio_url: '', audio_url_uk: '' }));
      console.log(`[Refresh] TTS result: audio_url="${tts.audio_url}", audio_url_uk="${tts.audio_url_uk}"`);

      if (!eudic.ipa_us && !eudic.ipa_uk && !tts.audio_url && !tts.audio_url_uk) {
        words = words.map(w => w.id === word.id ? original : w);
        showToast('refresh failed', 'error');
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
      showToast(`refreshed "${word.word}"`, 'success');
    } catch (e) {
      words = words.map(w => w.id === word.id ? original : w);
      showToast('refresh failed', 'error');
    } finally {
      refreshingWordId = null;
    }
  }

  // 乐观删除
  async function deleteWord(word: Word) {
    words = words.filter(w => w.id !== word.id);
    showToast(`rm "${word.word}"`, 'success');

    fetch(`/api/words?id=${word.id}`, { method: 'DELETE' }).catch(() => {
      words = [...words, word];
      showToast('rm failed, restored', 'error');
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
      alert('input at least one word');
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
          failed.push(`${word}: ${result.error || 'unknown error'}`);
          words = words.filter(w => w.id !== tempId);
        } else {
          success++;
          words = words.map(w => w.id === tempId ? { ...w, ...result.data } : w);
        }
      } catch (e) {
        failed.push(`${word}: ${e instanceof Error ? e.message : 'unknown error'}`);
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
      showToast(`imported ${success} word(s)`, 'success');
    }
    if (failed.length > 0) {
      showToast(`failed ${failed.length} word(s)`, 'error');
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
      uploadError = 'input audio URL';
      return;
    }

    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      uploadError = 'invalid URL format';
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
    showToast(`uploading "${uploadWordText}" audio...`, 'info');
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
      showToast(`uploaded "${uploadWordText}" audio`, 'success');
    } catch (e) {
      // 失败：恢复原音频 URL
      words = words.map(w => w.id === uploadWordId ? { ...w, audio_url: originalAudioUrl } : w);
      showToast(e instanceof Error ? e.message : 'upload failed', 'error');
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
    showToast(`uploading "${pendingWordText}" audio...`, 'info');
    
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
      showToast(`uploaded "${pendingWordText}" audio`, 'success');
    } catch (e) {
      // 失败：恢复原音频 URL
      words = words.map(w => w.id === pendingWordId ? { ...w, audio_url: originalAudioUrl } : w);
      showToast(e instanceof Error ? e.message : 'upload failed', 'error');
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
      showToast('no data', 'error');
      return;
    }

    loading = true;
    let updated = 0;
    let failed = 0;
    showToast('starting full-update...', 'info');

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
    showToast(`full-update done: ${updated} ok, ${failed} failed`, 'success');
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>admin - word management</title>
</svelte:head>

<!-- Snippets -->
{#snippet centerMessage(text: string)}
  <div class="flex min-h-screen items-center justify-center bg-terminal-bg">
    <div class="text-terminal-text-dim">{text}</div>
  </div>
{/snippet}

{#snippet playIcon(isPlaying: boolean)}
  {#if isPlaying}
    <span class="inline-block animate-pulse">▮▮</span>
  {:else}
    <span class="inline-block">▶</span>
  {/if}
{/snippet}

{#snippet toastIcon(type: 'success' | 'error' | 'info')}
  {#if type === 'success'}
    <span class="text-terminal-accent">[ok]</span>
  {:else if type === 'error'}
    <span class="text-terminal-error">[fail]</span>
  {:else}
    <span class="text-terminal-info">[info]</span>
  {/if}
{/snippet}

{#snippet ipaCell(word: Word, type: 'us' | 'uk')}
  {@const ipa = type === 'us' ? word.ipa : word.ipa_uk}
  {@const url = type === 'us' ? word.audio_url : word.audio_url_uk}
  {@const isPlaying = playingAudio?.id === word.id && playingAudio?.type === type}
  {@const hasAudio = !!url}
  {@const baseColor = type === 'us' ? 'text-terminal-info' : 'text-terminal-accent'}
  {@const hoverColor = type === 'us' ? 'hover:text-terminal-info hover:bg-terminal-bg-hover' : 'hover:text-terminal-accent-hover hover:bg-terminal-bg-hover'}
  {#if ipa}
    {#if hasAudio}
      <button
        onclick={() => playAudio(word, type)}
        class="inline-flex items-center gap-1 px-1.5 py-0.5 border border-transparent cursor-pointer {baseColor} {hoverColor} {isPlaying ? 'border-terminal-accent bg-terminal-bg-hover' : ''}"
        title="click to play"
      >
        <span>{ipa}</span>
        {#if isPlaying}
          {@render playIcon(true)}
        {/if}
      </button>
    {:else}
      <span class="text-terminal-text-muted px-1.5 py-0.5" title="no audio">{ipa}</span>
    {/if}
  {:else}
    <span class="text-terminal-text-dim">-</span>
  {/if}
{/snippet}

{#snippet btn(text: string, onclick: () => void, disabled?: boolean, loading?: boolean)}
  <button
    {onclick}
    {disabled}
    class="btn-terminal px-3 py-1 text-sm {disabled || loading ? 'opacity-50' : ''}"
  >
    {loading ? 'running...' : text}
  </button>
{/snippet}

{#snippet actionBtns(word: Word)}
  {@const refreshing = refreshingWordId === word.id}
  {@const uploading = uploadingAudioId === word.id}
  {@const disabled = refreshing || uploading}
  <div class="flex gap-2 justify-end">
    {@render btn('refresh', () => refreshWord(word), disabled, refreshing)}
    {@render btn('upload', () => openUploadModal(word), uploading, uploading)}
    <button
      onclick={() => deleteWord(word)}
      class="btn-terminal px-3 py-1 text-sm text-terminal-error hover:text-terminal-error hover:border-terminal-error"
      title="remove word"
    >
      rm
    </button>
  </div>
{/snippet}

{#if authLoading}
  {@render centerMessage('checking auth...')}
{:else if !isAuthenticated}
  {@render centerMessage('redirecting to login...')}
{:else}
  <div class="min-h-screen bg-terminal-bg text-terminal-text-primary font-mono">
    <!-- Toast 通知 -->
    {#if toastVisible}
      <div class="fixed bottom-6 right-6 z-50">
        <div class="flex items-center gap-3 px-4 py-2 border border-terminal-border bg-terminal-bg-secondary">
          {@render toastIcon(toastType)}
          <span class="text-sm text-terminal-text-primary">{toastMessage}</span>
          <button
            onclick={hideToast}
            class="ml-2 p-1 text-terminal-text-muted hover:text-terminal-text-secondary"
            aria-label="close"
          >
            ×
          </button>
        </div>
      </div>
    {/if}

    <!-- 顶部导航 -->
    <header class="sticky top-0 z-40 border-b border-terminal-border bg-terminal-bg-secondary">
      <div class="mx-auto max-w-7xl px-4 py-3">
        <div class="flex items-center justify-between">
          <h1 class="text-lg font-medium text-terminal-text-primary">
            $ <span class="text-terminal-accent">admin</span>
          </h1>
          <div class="flex items-center gap-4">
            <!-- 用户信息 -->
            <span class="text-sm text-terminal-text-secondary">
              {authState.user?.email || 'user'}
            </span>
            <!-- 退出按钮 -->
            {@render btn('logout', handleSignOut)}
            <!-- 模型选择器 -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-terminal-text-secondary">model:</span>
              <select
                bind:value={selectedModel}
                disabled={modelsLoading}
                class="input-terminal px-2 py-1 text-sm focus:border-terminal-accent"
              >
                {#if modelsLoading}
                  <option>loading...</option>
                {:else}
                  {#each availableModels as model (model.id)}
                    <option value={model.id}>{model.name}</option>
                  {/each}
                {/if}
              </select>
            </div>
            {@render btn('batch-import', () => showBatchModal = true)}
            {@render btn('full-update', fullUpdate, loading, loading)}
          </div>
        </div>
      </div>
    </header>

    <main class=" mx-auto max-w-2/3 px-4 py-4">
      <!-- 快速添加 -->
      <div class="mb-4">
        <div class="flex gap-2">
          <input
            type="text"
            placeholder="$ grep 'word' | add"
            bind:value={quickAddWord}
            onkeydown={(e) => e.key === 'Enter' && quickAdd()}
            disabled={quickAddLoading}
            class="input-terminal flex-1 px-3 py-2 placeholder:text-terminal-text-muted"
          />
          {@render btn('add', quickAdd, quickAddLoading, quickAddLoading)}
        </div>
        {#if quickAddError}
          <p class="mt-1 text-sm text-terminal-error">{quickAddError}</p>
        {/if}
      </div>

      <!-- 搜索框 -->
      <div class="mb-4">
        <input
          type="text"
          placeholder="$ grep 'pattern'"
          bind:value={searchQuery}
          class="input-terminal w-full px-3 py-2 sm:max-w-md placeholder:text-terminal-text-muted"
        />
      </div>

      <!-- 统计信息 -->
      <div class="mb-4 text-sm text-terminal-text-secondary">
        {filteredWords.length} entries
        {#if filteredWords.length !== words.length}
          ({words.length} total)
        {/if}
      </div>

      <!-- 词汇列表 -->
      {#if loading}
        <div class="py-8 text-center text-terminal-text-dim">loading...</div>
      {:else if error}
        <div class="py-8 text-center text-terminal-error">{error}</div>
      {:else if filteredWords.length === 0}
        <div class="py-8 text-center text-terminal-text-dim">-- no data --</div>
      {:else}
        <div class="border border-terminal-border">
          <table class="table-terminal">
            <thead>
              <tr>
                <th class="w-32">word</th>
                <th class="w-48">us</th>
                <th class="w-48">uk</th>
                <th class="w-64 text-right">actions</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredWords as word (word.id)}
                <tr>
                  <!-- 单词列 -->
                  <td class="py-2 font-medium text-terminal-text-primary">
                    {word.word}
                  </td>

                  <!-- 美音列（音标+发音） -->
                  <td class="py-2 text-sm">
                    {@render ipaCell(word, 'us')}
                  </td>

                  <!-- 英音列（音标+发音） -->
                  <td class="py-2 text-sm">
                    {@render ipaCell(word, 'uk')}
                  </td>

                  <!-- 操作列 -->
                  <td class="py-2 text-right text-sm">
                    {@render actionBtns(word)}
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
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div class="modal-terminal w-full max-w-lg p-4">
          <h2 class="mb-4 text-lg font-medium text-terminal-text-primary">
            $ <span class="text-terminal-accent">batch-import</span>
          </h2>
          <div class="space-y-4">
            <div>
              <span class="mb-2 block text-sm text-terminal-text-secondary">
                input words (one per line)
              </span>
              <textarea
                bind:value={batchText}
                rows="10"
                placeholder="coroutine&#10;async&#10;await&#10;suspend&#10;..."
                class="input-terminal w-full px-3 py-2 font-mono text-sm resize-none placeholder:text-terminal-text-muted"
              ></textarea>
            </div>

            {#if batchProgress}
              <div class="border border-terminal-border bg-terminal-bg-secondary p-3">
                <div class="mb-2 flex items-center justify-between text-sm">
                  <span class="text-terminal-info">importing: {batchProgress.word}</span>
                  <span class="font-medium text-terminal-text-secondary">
                    {batchProgress.current}/{batchProgress.total}
                  </span>
                </div>
                <div class="h-1 w-full bg-terminal-bg">
                  <div
                    class="h-full bg-terminal-accent transition-all"
                    style="width: {(batchProgress.current / batchProgress.total) * 100}%"
                  ></div>
                </div>
              </div>
            {/if}

            {#if batchResult}
              <div class="border p-3 {batchResult.failed.length > 0 ? 'border-terminal-warning' : 'border-terminal-accent'}">
                <p class="font-medium {batchResult.failed.length > 0 ? 'text-terminal-warning' : 'text-terminal-accent'}">
                  {batchResult.success} ok
                  {#if batchResult.failed.length > 0}
                    , {batchResult.failed.length} failed
                  {/if}
                </p>
                {#if batchResult.failed.length > 0}
                  <ul class="mt-2 max-h-32 overflow-y-auto text-sm text-terminal-error">
                    {#each batchResult.failed as err, i (i)}
                      <li>{err}</li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/if}

            <div class="flex justify-end gap-3 pt-4">
              {@render btn('close', closeBatchModal)}
              {@render btn('run', importBatch, batchLoading, batchLoading)}
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- 音频上传 Modal -->
    {#if showUploadModal}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div class="modal-terminal w-full max-w-md p-4">
          <h2 class="mb-4 text-lg font-medium text-terminal-text-primary">
            $ <span class="text-terminal-accent">upload-audio</span>
          </h2>
          <p class="mb-4 text-sm text-terminal-text-secondary">
            upload custom audio for <span class="text-terminal-text-primary">"{uploadWord?.word}"</span>
          </p>
          
          <!-- 模式切换 -->
          <div class="mb-4 flex gap-2">
            <button
              onclick={() => uploadMode = 'url'}
              class="flex-1 px-3 py-2 text-sm transition-colors
                     {uploadMode === 'url' ? 'bg-terminal-accent text-terminal-bg' : 'btn-terminal'}"
            >
              url
            </button>
            <button
              onclick={() => uploadMode = 'file'}
              class="flex-1 px-3 py-2 text-sm transition-colors
                     {uploadMode === 'file' ? 'bg-terminal-accent text-terminal-bg' : 'btn-terminal'}"
            >
              file
            </button>
          </div>
          
          {#if uploadMode === 'url'}
            <!-- URL 输入模式 -->
            <div class="space-y-4">
              <div>
                <span class="mb-2 block text-sm text-terminal-text-secondary">
                  audio URL
                </span>
                <input
                  type="url"
                  bind:value={uploadUrl}
                  placeholder="https://..."
                  class="input-terminal w-full px-3 py-2 text-sm placeholder:text-terminal-text-muted"
                />
                <p class="mt-1 text-xs text-terminal-text-muted">
                  supports: MP3, WAV, WebM, OGG
                </p>
              </div>
              
              {#if uploadError}
                <p class="text-sm text-terminal-error">{uploadError}</p>
              {/if}
              
              <div class="flex justify-end gap-3 pt-4">
                {@render btn('cancel', closeUploadModal)}
                {@render btn('upload', uploadAudioByUrl, uploadLoading, uploadLoading)}
              </div>
            </div>
          {:else}
            <!-- 文件上传模式 -->
            <div class="space-y-4">
              <div class="border border-dashed border-terminal-border p-6 text-center">
                <p class="mb-4 text-sm text-terminal-text-secondary">
                  click to select audio file
                </p>
                <p class="mb-4 text-xs text-terminal-text-muted">
                  MP3, WAV, WebM, OGG (max 10MB)
                </p>
                {@render btn('select file', () => uploadWord && triggerUploadFile(uploadWord))}
              </div>
              
              <div class="flex justify-end gap-3 pt-4">
                {@render btn('cancel', closeUploadModal)}
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
