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

  // 音频播放
  let playingId = $state<string | null>(null);
  let audioRef = $state<HTMLAudioElement | null>(null);

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

      await loadWords();
    } catch (e) {
      quickAddError = e instanceof Error ? e.message : '保存失败';
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

      editingId = null;
      await loadWords();
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败');
    } finally {
      editSaving = false;
    }
  }

  // 一键重新生成音频
  async function regenerateAudio(word: Word) {
    regeneratingAudioId = word.id;

    try {
      const audioUrl = await fetchTTS(word.word);

      if (!audioUrl) {
        alert('生成音频失败');
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
        throw new Error(result.error || '更新音频失败');
      }

      // 刷新列表
      await loadWords();
    } catch (e) {
      alert(e instanceof Error ? e.message : '重新生成音频失败');
    } finally {
      regeneratingAudioId = null;
    }
  }

  // 删除词汇
  async function deleteWord(word: Word) {
    if (!confirm(`确定删除 "${word.word}" 吗？`)) return;
    try {
      const response = await fetch(`/api/words?id=${word.id}`, { method: 'DELETE' });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '删除失败');
      }

      await loadWords();
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败');
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

    for (let i = 0; i < lines.length; i++) {
      const word = lines[i];
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
        } else {
          success++;
        }
      } catch (e) {
        failed.push(`${word}: ${e instanceof Error ? e.message : '未知错误'}`);
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
      await loadWords();
    }
  }

  // 关闭批量导入 Modal
  function closeBatchModal() {
    showBatchModal = false;
    batchText = '';
    batchResult = null;
    batchProgress = null;
  }
</script>

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
                      <!-- 浏览模式：显示重新生成音频按钮（高频操作） -->
                      <button
                        onclick={() => regenerateAudio(word)}
                        disabled={regeneratingAudioId === word.id}
                        class="mr-2 text-purple-600 hover:text-purple-800 disabled:opacity-50"
                        title="重新生成音频"
                      >
                        {regeneratingAudioId === word.id ? '生成中...' : '🔊'}
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
  </div>
{/if}
