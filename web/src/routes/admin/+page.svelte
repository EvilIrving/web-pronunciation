<script lang="ts">
  import { supabase } from '$lib/supabase';
  import {
    type Word,
    type WordInsert,
    type ProgrammingLanguage,
    type WordCategory,
    PROGRAMMING_LANGUAGES,
    WORD_CATEGORIES,
  } from '$lib/types';
  import { fetchPronunciation } from '$lib/dictionary';
  import { onMount } from 'svelte';

  // 状态
  let words = $state<Word[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Modal 状态
  let showModal = $state(false);
  let showBatchModal = $state(false);
  let editingWord = $state<Word | null>(null);

  // 表单数据
  let formData = $state<WordInsert>({
    word: '',
    language: 'common',
    category: 'common',
    tags: [],
  });
  let tagsInput = $state('');

  // 批量导入
  let batchText = $state('');
  let batchLanguage = $state<ProgrammingLanguage>('common');
  let batchCategory = $state<WordCategory>('common');
  let batchLoading = $state(false);
  let batchProgress = $state<{ current: number; total: number; word: string } | null>(null);
  let batchResult = $state<{ success: number; failed: string[] } | null>(null);

  // 单词保存加载状态
  let savingWord = $state(false);
  let fetchingPronunciation = $state(false);

  // 搜索和筛选
  let searchQuery = $state('');
  let filterLanguage = $state<ProgrammingLanguage | ''>('');
  let filterCategory = $state<WordCategory | ''>('');

  // 计算过滤后的词汇列表
  let filteredWords = $derived.by(() => {
    let result = words;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (w) => w.word.toLowerCase().includes(query) || w.normalized.includes(query)
      );
    }
    if (filterLanguage) {
      result = result.filter((w) => w.language === filterLanguage);
    }
    if (filterCategory) {
      result = result.filter((w) => w.category === filterCategory);
    }
    return result;
  });

  // 加载词汇列表
  async function loadWords() {
    loading = true;
    error = null;
    try {
      const { data, error: err } = await supabase
        .from('words')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      words = data || [];
    } catch (e) {
      error = e instanceof Error ? e.message : '加载失败';
    } finally {
      loading = false;
    }
  }

  // 打开新增 Modal
  function openAddModal() {
    editingWord = null;
    formData = {
      word: '',
      language: 'common',
      category: 'common',
      tags: [],
    };
    tagsInput = '';
    showModal = true;
  }

  // 打开编辑 Modal
  function openEditModal(word: Word) {
    editingWord = word;
    formData = {
      word: word.word,
      language: word.language,
      category: word.category,
      tags: word.tags || [],
    };
    tagsInput = (word.tags || []).join(', ');
    showModal = true;
  }

  // 关闭 Modal
  function closeModal() {
    showModal = false;
    editingWord = null;
  }

  // 保存词汇 (新增或更新)
  async function saveWord() {
    // 解析标签
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);
    formData.tags = tags;

    savingWord = true;

    try {
      // 新增时自动获取发音信息
      if (!editingWord) {
        fetchingPronunciation = true;
        try {
          const pronunciation = await fetchPronunciation(formData.word);
          formData.ipa_uk = pronunciation.ipa_uk;
          formData.audio_uk_url = pronunciation.audio_uk_url;
          formData.ipa_us = pronunciation.ipa_us;
          formData.audio_us_url = pronunciation.audio_us_url;
        } catch (e) {
          console.warn('获取发音失败:', e);
        } finally {
          fetchingPronunciation = false;
        }
      }

      if (editingWord) {
        // 更新
        const { error: err } = await supabase
          .from('words')
          .update({
            word: formData.word,
            language: formData.language,
            category: formData.category,
            tags: formData.tags,
          })
          .eq('id', editingWord.id);
        if (err) throw err;
      } else {
        // 新增
        const { error: err } = await supabase.from('words').insert(formData);
        if (err) throw err;
      }
      closeModal();
      await loadWords();
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存失败');
    } finally {
      savingWord = false;
    }
  }

  // 删除词汇
  async function deleteWord(word: Word) {
    if (!confirm(`确定删除 "${word.word}" 吗？`)) return;
    try {
      const { error: err } = await supabase.from('words').delete().eq('id', word.id);
      if (err) throw err;
      await loadWords();
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败');
    }
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
        // 获取发音信息
        const pronunciation = await fetchPronunciation(word);

        const { error: err } = await supabase.from('words').insert({
          word,
          language: batchLanguage,
          category: batchCategory,
          ipa_uk: pronunciation.ipa_uk,
          audio_uk_url: pronunciation.audio_uk_url,
          ipa_us: pronunciation.ipa_us,
          audio_us_url: pronunciation.audio_us_url,
        });
        if (err) {
          failed.push(`${word}: ${err.message}`);
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

  onMount(() => {
    loadWords();
  });
</script>

<svelte:head>
  <title>后台管理 - 词汇管理</title>
</svelte:head>

<div class="min-h-screen bg-gray-100">
  <!-- 顶部导航 -->
  <header class="bg-white shadow">
    <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-900">词汇管理后台</h1>
        <div class="flex gap-2">
          <button
            onclick={() => (showBatchModal = true)}
            class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            批量导入
          </button>
          <button
            onclick={openAddModal}
            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            新增词汇
          </button>
        </div>
      </div>
    </div>
  </header>

  <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <!-- 搜索和筛选 -->
    <div class="mb-6 space-y-4">
      <!-- 搜索框 -->
      <input
        type="text"
        placeholder="搜索词汇..."
        bind:value={searchQuery}
        class="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:max-w-md"
      />

      <!-- 语言筛选标签 -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-gray-600">语言:</span>
        {#each PROGRAMMING_LANGUAGES as lang}
          <button
            type="button"
            onclick={() => filterLanguage = filterLanguage === lang.value ? '' : lang.value}
            class="rounded-full px-3 py-1 text-sm font-medium transition-colors {filterLanguage === lang.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
          >
            {lang.label}
          </button>
        {/each}
      </div>

      <!-- 分类筛选标签 -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-gray-600">分类:</span>
        {#each WORD_CATEGORIES as cat}
          <button
            type="button"
            onclick={() => filterCategory = filterCategory === cat.value ? '' : cat.value}
            class="rounded-full px-3 py-1 text-sm font-medium transition-colors {filterCategory === cat.value ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
          >
            {cat.label}
          </button>
        {/each}
      </div>
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
                语言
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                分类
              </th>
              <th class="hidden px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase sm:table-cell">
                音标 (UK/US)
              </th>
              <th class="hidden px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase md:table-cell">
                标签
              </th>
              <th class="px-4 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            {#each filteredWords as word (word.id)}
              <tr class="hover:bg-gray-50">
                <td class="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                  {word.word}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {PROGRAMMING_LANGUAGES.find((l) => l.value === word.language)?.label || word.language}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                  {WORD_CATEGORIES.find((c) => c.value === word.category)?.label || word.category}
                </td>
                <td class="hidden whitespace-nowrap px-4 py-3 text-sm text-gray-600 sm:table-cell">
                  {word.ipa_uk || '-'} / {word.ipa_us || '-'}
                </td>
                <td class="hidden px-4 py-3 text-sm text-gray-600 md:table-cell">
                  {#if word.tags && word.tags.length > 0}
                    <div class="flex flex-wrap gap-1">
                      {#each word.tags as tag}
                        <span class="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                          {tag}
                        </span>
                      {/each}
                    </div>
                  {:else}
                    -
                  {/if}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-right text-sm">
                  <button
                    onclick={() => openEditModal(word)}
                    class="mr-2 text-blue-600 hover:text-blue-800"
                  >
                    编辑
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
</div>

<!-- 新增/编辑 Modal -->
{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <h2 class="mb-4 text-lg font-bold">{editingWord ? '编辑词汇' : '新增词汇'}</h2>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          saveWord();
        }}
        class="space-y-4"
      >
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">单词 *</label>
          <input
            type="text"
            required
            bind:value={formData.word}
            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">语言</label>
            <select
              bind:value={formData.language}
              class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {#each PROGRAMMING_LANGUAGES as lang}
                <option value={lang.value}>{lang.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">分类</label>
            <select
              bind:value={formData.category}
              class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {#each WORD_CATEGORIES as cat}
                <option value={cat.value}>{cat.label}</option>
              {/each}
            </select>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">标签 (逗号分隔)</label>
          <input
            type="text"
            placeholder="async, concurrency"
            bind:value={tagsInput}
            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
        </div>
        {#if fetchingPronunciation}
          <div class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            正在获取发音信息...
          </div>
        {/if}
        <div class="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onclick={closeModal}
            disabled={savingWord}
            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={savingWord}
            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {savingWord ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- 批量导入 Modal -->
{#if showBatchModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
      <h2 class="mb-4 text-lg font-bold">批量导入词汇</h2>
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700">
            输入单词 (每行一个)
          </label>
          <textarea
            bind:value={batchText}
            rows="10"
            placeholder="coroutine&#10;async&#10;await&#10;suspend&#10;..."
            class="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          ></textarea>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">默认语言</label>
            <select
              bind:value={batchLanguage}
              class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {#each PROGRAMMING_LANGUAGES as lang}
                <option value={lang.value}>{lang.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-gray-700">默认分类</label>
            <select
              bind:value={batchCategory}
              class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {#each WORD_CATEGORIES as cat}
                <option value={cat.value}>{cat.label}</option>
              {/each}
            </select>
          </div>
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
