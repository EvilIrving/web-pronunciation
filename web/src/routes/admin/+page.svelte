<script lang="ts">
  import type { Word } from '$lib/types';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authState, signOut, initAuth } from '$lib/auth.svelte';
  import { supabase } from '$lib/supabase';
  import { browser } from '$app/environment';
  import { toast } from '$lib/toast.svelte';
  import { player } from '$lib/audio.svelte';
  import * as api from '$lib/api';

  type Accent = 'us' | 'uk';

  let words = $state<Word[]>([]);
  let loading = $state(true);
  let err = $state('');
  let authed = $state(false);
  let authLoading = $state(true);
  let query = $state('');
  let input = $state('');
  let adding = $state(false);
  let refreshing = $state<string | null>(null);
  let models = $state<Array<{ id: string; name: string }>>([]);
  let model = $state('kimi');

  let batch = $state({ show: false, text: '', loading: false, progress: null as { cur: number; total: number; word: string } | null, result: null as { ok: number; failed: string[] } | null });
  let upload = $state({ show: false, mode: 'url' as 'url' | 'file', url: '', word: null as Word | null, err: '' });
  let fileRef = $state<HTMLInputElement | null>(null);

  let filtered = $derived(query ? words.filter(w => w.word.toLowerCase().includes(query.toLowerCase()) || w.normalized.includes(query.toLowerCase())) : words);

  onMount(() => {
    if (browser) {
      try { authState.user = JSON.parse(localStorage.getItem('auth_user') || 'null'); } catch {}
    }
    initAuth();
    setTimeout(async () => {
      if (authState.user) { authed = true; load(); loadModels(); }
      else {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) { authState.user = data.session.user; authed = true; load(); loadModels(); }
        else goto('/login');
      }
      authLoading = false;
    }, 500);
  });

  async function load() {
    loading = true; err = '';
    const res = await api.getWords({ limit: 10000 });
    if (res.error) err = res.error;
    else words = res.data;
    loading = false;
  }

  async function loadModels() {
    const res = await api.getModels();
    models = res.models; model = res.defaultModel;
  }

  function tempWord(word: string): Word {
    return { id: `temp-${Date.now()}`, word, ipa: null, audio_url: null, ipa_uk: null, audio_url_uk: null, normalized: word.toLowerCase(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  }

  async function add() {
    const w = input.trim(); if (!w) return;
    input = ''; adding = true;
    const temp = tempWord(w); words = [temp, ...words];
    toast.show(`adding "${w}"...`, 'info');
    try {
      const ipa = await api.fetchEudic(w).catch(() => ({ ipa_us: '', ipa_uk: '' }));
      const tts = await api.fetchTTS(w).catch(() => ({ audio_url: '', audio_url_uk: '' }));
      const res = await api.addWord({ word: w, ipa: ipa.ipa_us || ipa.ipa_uk, ipa_uk: ipa.ipa_uk, audio_url: tts.audio_url, audio_url_uk: tts.audio_url_uk });
      if (res.error) throw new Error(res.error);
      words = words.map(x => x.id === temp.id ? { ...x, ...res.data } : x);
      toast.show(`added "${w}"`, 'success');
    } catch (e) { words = words.filter(x => x.id !== temp.id); toast.show(e instanceof Error ? e.message : 'failed', 'error'); }
    adding = false;
  }

  async function refresh(w: Word) {
    refreshing = w.id; const orig = { ...w };
    words = words.map(x => x.id === w.id ? { ...x, ipa: '', ipa_uk: '', audio_url: '', audio_url_uk: '' } : x);
    toast.show(`refreshing "${w.word}"...`, 'info');
    try {
      const ipa = await api.fetchEudic(w.word).catch(() => ({ ipa_us: '', ipa_uk: '' }));
      const tts = await api.fetchTTS(w.word).catch(() => ({ audio_url: '', audio_url_uk: '' }));
      if (!ipa.ipa_us && !ipa.ipa_uk && !tts.audio_url) { words = words.map(x => x.id === w.id ? orig : x); toast.show('failed', 'error'); refreshing = null; return; }
      const res = await api.updateWord({ id: w.id, ipa: ipa.ipa_us || ipa.ipa_uk, ipa_uk: ipa.ipa_uk, audio_url: tts.audio_url, audio_url_uk: tts.audio_url_uk });
      if (res.error) throw new Error(res.error);
      words = words.map(x => x.id === w.id ? { ...x, ...res.data } : x);
      toast.show(`refreshed "${w.word}"`, 'success');
    } catch { words = words.map(x => x.id === w.id ? orig : x); toast.show('failed', 'error'); }
    refreshing = null;
  }

  async function rm(w: Word) {
    words = words.filter(x => x.id !== w.id); toast.show(`rm "${w.word}"`, 'success');
    api.deleteWord(w.id).catch(() => { words = [...words, w]; toast.show('rm failed', 'error'); });
  }

  function play(w: Word, acc: Accent) { player.play(w.id, acc, acc === 'us' ? w.audio_url : w.audio_url_uk); }

  async function importBatch() {
    const lines = batch.text.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    batch.loading = true; batch.result = null;
    const temps = lines.map((w, i) => ({ ...tempWord(w), id: `temp-${Date.now()}-${i}` }));
    words = [...temps, ...words];
    let ok = 0; const failed: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const w = lines[i], id = temps[i].id;
      batch.progress = { cur: i + 1, total: lines.length, word: w };
      try {
        const ipa = await api.fetchEudic(w).catch(() => ({ ipa_us: '', ipa_uk: '' }));
        const tts = await api.fetchTTS(w).catch(() => ({ audio_url: '', audio_url_uk: '' }));
        const res = await api.addWord({ word: w, ipa: ipa.ipa_us || ipa.ipa_uk, ipa_uk: ipa.ipa_uk, audio_url: tts.audio_url, audio_url_uk: tts.audio_url_uk });
        if (res.error) { failed.push(`${w}: ${res.error}`); words = words.filter(x => x.id !== id); }
        else { ok++; words = words.map(x => x.id === id ? { ...x, ...res.data } : x); }
      } catch (e) { failed.push(`${w}: ${e instanceof Error ? e.message : 'err'}`); words = words.filter(x => x.id !== id); }
      if (i < lines.length - 1) await new Promise(r => setTimeout(r, 3000));
    }
    batch.result = { ok, failed }; batch.loading = false; batch.progress = null;
    if (ok) toast.show(`imported ${ok}`, 'success');
    if (failed.length) toast.show(`failed ${failed.length}`, 'error');
  }

  async function uploadByUrl() {
    const url = upload.url.trim();
    try { new URL(url); } catch { upload.err = 'invalid url'; return; }
    if (!upload.word) return;
    const { id, word } = upload.word, orig = upload.word.audio_url;
    upload.show = false; words = words.map(x => x.id === id ? { ...x, audio_url: '' } : x);
    toast.show(`uploading...`, 'info');
    try {
      const { audio_url } = await api.uploadAudio({ url, word });
      await api.updateWord({ id, audio_url });
      words = words.map(x => x.id === id ? { ...x, audio_url } : x);
      toast.show('uploaded', 'success');
    } catch (e) { words = words.map(x => x.id === id ? { ...x, audio_url: orig } : x); toast.show(e instanceof Error ? e.message : 'failed', 'error'); }
  }

  async function handleFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !upload.word) return;
    const { id, word } = upload.word, orig = upload.word.audio_url;
    upload.show = false; words = words.map(x => x.id === id ? { ...x, audio_url: '' } : x);
    toast.show('uploading...', 'info');
    try {
      const { audio_url } = await api.uploadAudio({ file, word });
      await api.updateWord({ id, audio_url });
      words = words.map(x => x.id === id ? { ...x, audio_url } : x);
      toast.show('uploaded', 'success');
    } catch (e) { words = words.map(x => x.id === id ? { ...x, audio_url: orig } : x); toast.show(e instanceof Error ? e.message : 'failed', 'error'); }
    if (fileRef) fileRef.value = '';
  }
</script>

<svelte:head><title>admin</title></svelte:head>

{#snippet center(text: string)}<div class="flex min-h-screen items-center justify-center bg-terminal-bg"><div class="text-terminal-text-dim">{text}</div></div>{/snippet}

{#snippet icon(type: 'success' | 'error' | 'info')}
  {#if type === 'success'}<span class="text-terminal-accent">[ok]</span>
  {:else if type === 'error'}<span class="text-terminal-error">[fail]</span>
  {:else}<span class="text-terminal-info">[info]</span>{/if}
{/snippet}

{#snippet ipa(w: Word, acc: Accent)}
  {@const txt = acc === 'us' ? w.ipa : w.ipa_uk}
  {@const url = acc === 'us' ? w.audio_url : w.audio_url_uk}
  {@const active = player.isPlaying(w.id, acc)}
  {@const color = acc === 'us' ? 'text-terminal-info' : 'text-terminal-accent'}
  {#if txt}
    {#if url}
      <button onclick={() => play(w, acc)} class="inline-flex items-center gap-1 px-1.5 py-0.5 border border-transparent cursor-pointer {color} hover:bg-terminal-bg-hover {active ? 'border-terminal-accent bg-terminal-bg-hover' : ''}">
        <span>{txt}</span>{#if active}<span class="animate-pulse">▮▮</span>{/if}
      </button>
    {:else}<span class="text-terminal-text-muted px-1.5 py-0.5">{txt}</span>{/if}
  {:else}<span class="text-terminal-text-dim">-</span>{/if}
{/snippet}

{#snippet btn(text: string, onclick: () => void, dis?: boolean, run?: boolean)}
  <button {onclick} disabled={dis} class="btn-terminal px-3 py-1 text-sm {dis || run ? 'opacity-50' : ''}">{run ? '...' : text}</button>
{/snippet}

{#snippet acts(w: Word)}
  {@const r = refreshing === w.id}
  <div class="flex gap-2 justify-end">
    {@render btn('refresh', () => refresh(w), r, r)}
    {@render btn('upload', () => { upload.word = w; upload.show = true; upload.url = ''; upload.err = ''; })}
    <button onclick={() => rm(w)} class="btn-terminal px-3 py-1 text-sm text-terminal-error hover:border-terminal-error">rm</button>
  </div>
{/snippet}

{#if authLoading}
  {@render center('checking auth...')}
{:else if !authed}
  {@render center('redirecting...')}
{:else}
  <div class="min-h-screen bg-terminal-bg text-terminal-text-primary font-mono">
    {#if toast.visible}
      <div class="fixed bottom-6 right-6 z-50">
        <div class="flex items-center gap-3 px-4 py-2 border border-terminal-border bg-terminal-bg-secondary">
          {@render icon(toast.type)}
          <span class="text-sm">{toast.msg}</span>
          <button onclick={() => toast.hide()} class="ml-2 p-1 text-terminal-text-muted hover:text-terminal-text-secondary">×</button>
        </div>
      </div>
    {/if}

    <header class="sticky top-0 z-40 border-b border-terminal-border bg-terminal-bg-secondary">
      <div class="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <h1 class="text-lg">$ <span class="text-terminal-accent">admin</span></h1>
        <div class="flex items-center gap-4">
          <span class="text-sm text-terminal-text-secondary">{authState.user?.email || 'user'}</span>
          {@render btn('logout', () => { signOut(); goto('/'); })}
          <select bind:value={model} class="input-terminal px-2 py-1 text-sm">
            {#each models as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
          </select>
          {@render btn('batch', () => batch.show = true)}
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 py-4">
      <div class="mb-4 flex gap-2">
        <input type="text" placeholder="add word..." bind:value={input} onkeydown={(e) => e.key === 'Enter' && add()} disabled={adding} class="input-terminal flex-1 px-3 py-2" />
        {@render btn('add', add, adding, adding)}
      </div>
      <div class="mb-4">
        <input type="text" placeholder="search..." bind:value={query} class="input-terminal w-full px-3 py-2 sm:max-w-md" />
      </div>
      <div class="mb-4 text-sm text-terminal-text-secondary">{filtered.length} entries {#if filtered.length !== words.length}({words.length} total){/if}</div>

      {#if loading}
        <div class="py-8 text-center text-terminal-text-dim">loading...</div>
      {:else if err}
        <div class="py-8 text-center text-terminal-error">{err}</div>
      {:else if !filtered.length}
        <div class="py-8 text-center text-terminal-text-dim">-- no data --</div>
      {:else}
        <div class="border border-terminal-border">
          <table class="table-terminal">
            <thead><tr><th class="w-32">word</th><th class="w-48">us</th><th class="w-48">uk</th><th class="w-64 text-right">actions</th></tr></thead>
            <tbody>
              {#each filtered as w (w.id)}
                <tr>
                  <td class="py-2 font-medium text-terminal-text-primary">{w.word}</td>
                  <td class="py-2 text-sm">{@render ipa(w, 'us')}</td>
                  <td class="py-2 text-sm">{@render ipa(w, 'uk')}</td>
                  <td class="py-2 text-right text-sm">{@render acts(w)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </main>

    <input type="file" accept="audio/*" bind:this={fileRef} onchange={handleFile} class="hidden" />

    {#if batch.show}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div class="modal-terminal w-full max-w-lg p-4">
          <h2 class="mb-4 text-lg">$ <span class="text-terminal-accent">batch-import</span></h2>
          <textarea bind:value={batch.text} rows="10" placeholder="word1&#10;word2&#10;..." class="input-terminal w-full px-3 py-2 font-mono text-sm resize-none"></textarea>
          {#if batch.progress}
            <div class="mt-4 border border-terminal-border p-3">
              <div class="flex justify-between text-sm"><span>{batch.progress.word}</span><span>{batch.progress.cur}/{batch.progress.total}</span></div>
              <div class="mt-2 h-1 bg-terminal-bg"><div class="h-full bg-terminal-accent" style="width: {(batch.progress.cur / batch.progress.total) * 100}%"></div></div>
            </div>
          {/if}
          {#if batch.result}
            <div class="mt-4 border p-3 {batch.result.failed.length ? 'border-terminal-warning' : 'border-terminal-accent'}">
              <p class="{batch.result.failed.length ? 'text-terminal-warning' : 'text-terminal-accent'}">{batch.result.ok} ok{#if batch.result.failed.length}, {batch.result.failed.length} failed{/if}</p>
              {#if batch.result.failed.length}<ul class="mt-2 max-h-32 overflow-y-auto text-sm text-terminal-error">{#each batch.result.failed as e, i (i)}<li>{e}</li>{/each}</ul>{/if}
            </div>
          {/if}
          <div class="mt-4 flex justify-end gap-3">
            {@render btn('close', () => { batch.show = false; batch.text = ''; batch.result = null; })}
            {@render btn('run', importBatch, batch.loading, batch.loading)}
          </div>
        </div>
      </div>
    {/if}

    {#if upload.show}
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div class="modal-terminal w-full max-w-md p-4">
          <h2 class="mb-4 text-lg">$ <span class="text-terminal-accent">upload-audio</span></h2>
          <p class="mb-4 text-sm text-terminal-text-secondary">for: <span class="text-terminal-text-primary">{upload.word?.word}</span></p>
          <div class="mb-4 flex gap-2">
            <button onclick={() => upload.mode = 'url'} class="flex-1 px-3 py-2 text-sm {upload.mode === 'url' ? 'bg-terminal-accent text-terminal-bg' : 'btn-terminal'}">url</button>
            <button onclick={() => upload.mode = 'file'} class="flex-1 px-3 py-2 text-sm {upload.mode === 'file' ? 'bg-terminal-accent text-terminal-bg' : 'btn-terminal'}">file</button>
          </div>
          {#if upload.mode === 'url'}
            <input type="url" bind:value={upload.url} placeholder="https://..." class="input-terminal w-full px-3 py-2 text-sm" />
            {#if upload.err}<p class="mt-2 text-sm text-terminal-error">{upload.err}</p>{/if}
            <div class="mt-4 flex justify-end gap-3">
              {@render btn('cancel', () => upload.show = false)}
              {@render btn('upload', uploadByUrl)}
            </div>
          {:else}
            <div class="border border-dashed border-terminal-border p-6 text-center">
              <p class="mb-4 text-sm">click to select audio file</p>
              {@render btn('select', () => fileRef?.click())}
            </div>
            <div class="mt-4 flex justify-end">{@render btn('cancel', () => upload.show = false)}</div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{/if}
