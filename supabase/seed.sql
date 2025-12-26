-- ============================================
-- 示例数据 (Seed Data)
-- 用于开发和测试
-- ============================================

INSERT INTO words (word, language, category, tags, ipa_uk, ipa_us) VALUES
  -- Kotlin 相关
  ('coroutine', 'kotlin', 'concept', ARRAY['async', 'concurrency'], '/ˌkɒr.uːˈtiːn/', '/ˌkɔːr.uːˈtiːn/'),
  ('suspend', 'kotlin', 'keyword', ARRAY['async', 'coroutine'], '/səˈspend/', '/səˈspend/'),
  ('lateinit', 'kotlin', 'keyword', ARRAY['initialization'], NULL, NULL),
  
  -- JavaScript/TypeScript 相关
  ('async', 'javascript', 'keyword', ARRAY['async', 'concurrency'], '/əˈsɪŋk/', '/əˈsɪŋk/'),
  ('await', 'javascript', 'keyword', ARRAY['async', 'concurrency'], '/əˈweɪt/', '/əˈweɪt/'),
  ('promise', 'javascript', 'concept', ARRAY['async'], '/ˈprɒm.ɪs/', '/ˈprɑː.mɪs/'),
  ('tuple', 'typescript', 'concept', ARRAY['type'], '/ˈtjuː.pəl/', '/ˈtuː.pəl/'),
  
  -- 通用技术词汇
  ('cache', 'common', 'concept', ARRAY['performance', 'storage'], '/kæʃ/', '/kæʃ/'),
  ('daemon', 'common', 'concept', ARRAY['process', 'system'], '/ˈdiː.mən/', '/ˈdiː.mən/'),
  ('enum', 'common', 'keyword', ARRAY['type'], '/ˈiː.nʌm/', '/ˈiː.nʌm/'),
  ('nginx', 'common', 'tool', ARRAY['server', 'web'], '/ˌen.dʒɪnˈeks/', '/ˌen.dʒɪnˈeks/'),
  ('sudo', 'shell', 'tool', ARRAY['linux', 'permission'], '/ˈsuː.duː/', '/ˈsuː.duː/'),
  ('char', 'common', 'keyword', ARRAY['type'], '/tʃɑːr/', '/tʃɑːr/'),
  ('null', 'common', 'keyword', ARRAY['type'], '/nʌl/', '/nʌl/'),
  ('boolean', 'common', 'keyword', ARRAY['type'], '/ˈbuː.li.ən/', '/ˈbuː.li.ən/'),
  
  -- 框架/库
  ('kubernetes', 'common', 'tool', ARRAY['container', 'orchestration'], '/ˌkuː.bərˈnet.iːz/', '/ˌkuː.bərˈnet.iːz/'),
  ('postgresql', 'sql', 'tool', ARRAY['database'], '/ˌpəʊstˈɡres.kjuː.el/', '/ˌpoʊstˈɡres.kjuː.el/'),
  ('vue', 'javascript', 'framework', ARRAY['frontend', 'ui'], '/vjuː/', '/vjuː/'),
  ('svelte', 'javascript', 'framework', ARRAY['frontend', 'ui'], '/svelt/', '/svelt/');
