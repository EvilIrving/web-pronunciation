<script lang="ts">
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

  // 行内编辑状态
  let editingId = $state<string | null>(null);
  let editForm = $state<{ word: string; ipa: string }>({
    word: '',
    ipa: '',
  });
  let editSaving = $state(false);

  // 音频重新生成状态（按行跟踪）
  let regeneratingAudioId = $state<string | null>(null);

  // 音频上传状态（按行跟踪）
  let uploadingAudioId = $state<string | null>(null);

  // 隐藏的文件输入元素
  let fileInputRef = $state<HTMLInputElement | null>(null);
  let pendingUploadWord = $state<Word | null>(null);

  // 音频播放
  let playingId = $state<string | null>(null);
  let audioRef = $state<HTMLAudioElement | null>(null);

  // 删除队列（待撤销的项）
  interface DeletedItem {
    id: string;
    word: Word;
    deletedAt: number;
  }
  let deletedQueue = $state<DeletedItem[]>([]);
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
  async function fetchIPA(word: string): Promise<string> {
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

    return result.ipa;
  }

  // 调用 TTS API 生成音频
  async function fetchTTS(word: string): Promise<string> {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '生成音频失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error('生成音频失败');
    }

    return result.audio_url;
  }

  // 快速添加单词
  async function quickAdd() {
    const word = quickAddWord.trim();
    if (!word) return;

    // 立即清空输入并重置状态，提供即时反馈
    quickAddWord = '';
    quickAddError = null;
    quickAddLoading = true;

    // 创建临时的乐观更新对象（使用临时 ID）
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticWord: Word = {
      id: tempId,
      word: word,
      ipa: null,
      audio_url: null,
      normalized: word.toLowerCase(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. 乐观更新：立即添加到列表顶部
    words = [optimisticWord, ...words];
    showToast(`正在添加「${word}」...`, 'info');

    try {
      // 获取发音信息
      let ipa = '';
      let audioUrl = '';
      try {
        // 并行获取 IPA 和音频
        const [ipaResult, audioResult] = await Promise.all([
          fetchIPA(word),
          fetchTTS(word),
        ]);
        ipa = ipaResult;
        audioUrl = audioResult;
      } catch (e) {
        console.warn('获取发音失败:', e);
      }

      const response = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, ipa, audio_url: audioUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '保存失败');
      }

      // 2. 成功：用服务器返回的真实数据替换乐观对象
      words = words.map(w => w.id === tempId ? { ...w, ...result.data } : w);
      showToast(`已添加「${word}」`, 'success');
    } catch (e) {
      // 失败：移除乐观对象
      words = words.filter(w => w.id !== tempId);
      quickAddError = e instanceof Error ? e.message : '保存失败';
      showToast(quickAddError, 'error');
    } finally {
      quickAddLoading = false;
    }
  }

  // 开始行内编辑
  function startEdit(word: Word) {
    editingId = word.id;
    editForm = {
      word: word.word,
      ipa: word.ipa || '',
    };
  }

  // 取消编辑
  function cancelEdit() {
    editingId = null;
    editForm = { word: '', ipa: '' };
  }

  // 保存编辑
  async function saveEdit(id: string) {
    editSaving = true;

    // 查找被编辑的词
    const originalWord = words.find(w => w.id === id);
    if (!originalWord) {
      editSaving = false;
      return;
    }

    // 创建乐观更新的词
    const optimisticWord: Word = {
      ...originalWord,
      word: editForm.word,
      ipa: editForm.ipa || null,
    };

    // 1. 乐观更新：立即更新 UI
    words = words.map(w => w.id === id ? optimisticWord : w);
    editingId = null;
    showToast(`正在保存「${originalWord.word}」...`, 'info');

    try {
      const response = await fetch('/api/words', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, word: editForm.word, ipa: editForm.ipa }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '保存失败');
      }

      // 2. 成功：确保数据同步
      words = words.map(w => w.id === id ? { ...w, ...result.data } : w);
      showToast(`已保存「${editForm.word}」`, 'success');
    } catch (e) {
      // 失败：回滚到原始数据
      words = words.map(w => w.id === id ? originalWord : w);
      showToast(e instanceof Error ? e.message : '保存失败', 'error');
    } finally {
      editSaving = false;
    }
  }

  // 一键重新生成音频
  async function regenerateAudio(word: Word) {
    regeneratingAudioId = word.id;

    // 1. 乐观更新：立即清空音频 URL（显示生成中状态）
    words = words.map(w => w.id === word.id ? { ...w, audio_url: '' } : w);
    showToast(`正在为「${word.word}」生成音频...`, 'info');

    try {
      const audioUrl = await fetchTTS(word.word);

      if (!audioUrl) {
        // 失败：恢复原音频 URL
        words = words.map(w => w.id === word.id ? { ...w, audio_url: word.audio_url } : w);
        showToast('生成音频失败', 'error');
        regeneratingAudioId = null;
        return;
      }

      // 更新数据库中的音频URL
      const response = await fetch('/api/words', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: word.id, audio_url: audioUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        // 失败：恢复原音频 URL
        words = words.map(w => w.id === word.id ? { ...w, audio_url: word.audio_url } : w);
        throw new Error(result.error || '更新音频失败');
      }

      // 成功：更新音频 URL
      words = words.map(w => w.id === word.id ? { ...w, audio_url: audioUrl } : w);
      showToast(`已为「${word.word}」生成音频`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '重新生成音频失败', 'error');
    } finally {
      regeneratingAudioId = null;
    }
  }

  // 乐观删除 + 后台同步
  async function deleteWord(word: Word) {
    // 1. 乐观更新：立即从 UI 移除
    words = words.filter(w => w.id !== word.id);
    
    // 2. 加入撤销队列
    deletedQueue.push({ id: word.id, word, deletedAt: Date.now() });
    
    // 3. 显示 Toast
    const count = deletedQueue.length;
    if (count === 1) {
      showToast(`已删除「${word.word}」`, 'success');
    } else {
      showToast(`已删除 ${count} 项`, 'success');
    }
    
    // 4. 后台异步调用 API（Promise.fire-and-forget）
    fetch(`/api/words?id=${word.id}`, { method: 'DELETE' })
      .then(async (res) => {
        if (!res.ok) throw new Error('删除失败');
        
        // 5秒后从队列移除（若用户未撤销）
        setTimeout(() => {
          deletedQueue = deletedQueue.filter(d => d.id !== word.id);
        }, 5000);
      })
      .catch(async (err) => {
        console.error('Delete error:', err);
        
        // 失败：回滚 UI
        words = [...words, word];
        deletedQueue = deletedQueue.filter(d => d.id !== word.id);
        
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

  // 撤销最近删除
  function undoDelete() {
    if (deletedQueue.length === 0) return;
    
    const last = deletedQueue[deletedQueue.length - 1];
    deletedQueue = deletedQueue.slice(0, -1);
    
    // 恢复 UI
    words = [...words, last.word];
    
    showToast(`已恢复「${last.word.word}」`, 'info');
  }

  // 键盘快捷键
  function handleKeydown(event: KeyboardEvent) {
    // Cmd/Ctrl + Z: 撤销
    if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
      event.preventDefault();
      undoDelete();
      return;
    }
  }

  // 播放音频
  function playAudio(word: Word) {
    if (!word.audio_url) return;

    if (playingId === word.id) {
      // 停止播放
      if (audioRef) {
        audioRef.pause();
        audioRef.currentTime = 0;
      }
      playingId = null;
    } else {
      // 开始播放
      playingId = word.id;
      // 等待 DOM 更新后播放
      setTimeout(() => {
        if (audioRef) {
          audioRef.play().catch((e) => {
            console.error('播放失败:', e);
            playingId = null;
          });
        }
      }, 50);
    }
  }

  function onAudioEnded() {
    playingId = null;
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
        // 并行获取发音信息
        let ipa = '';
        let audioUrl = '';
        try {
          const [ipaResult, audioResult] = await Promise.all([
            fetchIPA(word),
            fetchTTS(word),
          ]);
          ipa = ipaResult;
          audioUrl = audioResult;
        } catch (e) {
          console.warn(`获取发音失败 ${word}:`, e);
        }

        const response = await fetch('/api/words', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word, ipa, audio_url: audioUrl }),
        });

        const result = await response.json();

        if (!response.ok) {
          failed.push(`${word}: ${result.error || '未知错误'}`);
          // 失败：移除乐观对象
          words = words.filter(w => w.id !== tempId);
        } else {
          success++;
          // 成功：用服务器数据替换乐观对象
          words = words.map(w => w.id === tempId ? { ...w, ...result.data } : w);
        }
      } catch (e) {
        failed.push(`${word}: ${e instanceof Error ? e.message : '未知错误'}`);
        // 失败：移除乐观对象
        words = words.filter(w => w.id !== tempId);
      }

      // 添加小延迟避免请求过快
      if (i < lines.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
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
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>后台管理 - 词汇管理</title>
</svelte:head>

{#if authLoading}
  <div class="flex min-h-screen items-center justify-center bg-gray-100">
    <div class="text-gray-500">检查登录状态...</div>
  </div>
{:else if !isAuthenticated}
  <div class="flex min-h-screen items-center justify-center bg-gray-100">
    <div class="text-gray-500">正在重定向到登录页...</div>
  </div>
{:else}
  <div class="min-h-screen bg-gray-100">
    <!-- Toast 通知 -->
    {#if toastVisible}
      <div class="fixed bottom-6 right-6 z-50 animate-fade-in">
        <div class="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-lg border
                    {toastType === 'success' ? 'border-green-200' : toastType === 'error' ? 'border-red-200' : 'border-blue-200'}">
          {#if toastType === 'success'}
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {:else if toastType === 'error'}
            <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          {:else}
            <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          {/if}
          <span class="text-sm text-gray-700 font-medium">{toastMessage}</span>
          {#if deletedQueue.length > 0}
            <button
              onclick={undoDelete}
              class="ml-2 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 
                     hover:bg-blue-50 rounded-lg transition-colors"
            >
              撤销
            </button>
          {/if}
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
                  {#each availableModels as model}
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
                <th class="hidden px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase sm:table-cell">
                  音标
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  音频
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
                    {#if editingId === word.id}
                      <input
                        type="text"
                        bind:value={editForm.word}
                        class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    {:else}
                      <span class="font-medium text-gray-900">{word.word}</span>
                    {/if}
                  </td>

                  <!-- 音标列 -->
                  <td class="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                    {#if editingId === word.id}
                      <input
                        type="text"
                        bind:value={editForm.ipa}
                        placeholder="音标"
                        class="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    {:else}
                      {word.ipa || '-'}
                    {/if}
                  </td>

                  <!-- 音频列 -->
                  <td class="whitespace-nowrap px-4 py-3">
                    {#if word.audio_url}
                      <button
                        onclick={() => playAudio(word)}
                        class="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        title={playingId === word.id ? '停止播放' : '播放发音'}
                      >
                        {#if playingId === word.id}
                          <svg class="h-5 w-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                        {:else}
                          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        {/if}
                      </button>
                    {:else}
                      <span class="text-gray-400">-</span>
                    {/if}
                  </td>

                  <!-- 操作列 -->
                  <td class="whitespace-nowrap px-4 py-3 text-right text-sm">
                    {#if editingId === word.id}
                      <!-- 编辑模式：仅保存和取消 -->
                      <button
                        onclick={() => saveEdit(word.id)}
                        disabled={editSaving}
                        class="mr-2 text-green-600 hover:text-green-800 disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        onclick={cancelEdit}
                        disabled={editSaving}
                        class="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                      >
                        取消
                      </button>
                    {:else}
                      <!-- 浏览模式：显示音频操作按钮（高频操作） -->
                      <button
                        onclick={() => regenerateAudio(word)}
                        disabled={regeneratingAudioId === word.id || uploadingAudioId === word.id}
                        class="mr-2 text-purple-600 hover:text-purple-800 disabled:opacity-50"
                        title="重新生成音频"
                      >
                        {regeneratingAudioId === word.id ? '生成中...' : '🔊'}
                      </button>
                      <button
                        onclick={() => openUploadModal(word)}
                        disabled={uploadingAudioId === word.id}
                        class="mr-2 text-orange-600 hover:text-orange-800 disabled:opacity-50"
                        title="上传自定义音频"
                      >
                        {uploadingAudioId === word.id ? '上传中...' : '📤'}
                      </button>
                      <button
                        onclick={() => startEdit(word)}
                        class="mr-2 text-blue-600 hover:text-blue-800"
                      >
                        编辑
                      </button>
                      <button onclick={() => deleteWord(word)} class="text-red-600 hover:text-red-800">
                        删除
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </main>

    <!-- 隐藏的音频元素 -->
    <audio
      bind:this={audioRef}
      onended={onAudioEnded}
      src={playingId ? words.find((w) => w.id === playingId)?.audio_url : ''}
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
                    {#each batchResult.failed as err}
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

