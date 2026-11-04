// Writes the starter published-data.js (the site's default library) so the
// deployed page shows real content even in a fresh browser profile.
//
// After writing your own notes in the editor, run:
//   node tools/build.mjs --library library.json
// which replaces this file with your export.
//
// Usage: node tools/make-default-data.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const library = {
  bars: [{
    id: 'main',
    name: '学习笔记',
    groups: ['开始', '计算机基础', '数据结构与算法', 'Agent 与工具', '学习日志'],
    posts: [
      {
        id: 'welcome',
        group: '开始',
        title: '欢迎来到学习笔记',
        md: [
          '# 欢迎来到学习笔记',
          '',
          '这里是个人知识库：算法、计算机基础、Agent 与工具实践。',
          '',
          '## 怎么用',
          '',
          '- 左侧展开分类，点击文章阅读。',
          '- 新建笔记、新建分类、导入 Markdown。',
          '- 内容保存在当前浏览器，随时「导出网站」或「复制笔记数据」备份。',
          '',
          '## 代码块',
          '',
          '```python',
          'def bubble_sort(arr):',
          '    n = len(arr)',
          '    for i in range(n - 1):',
          '        for j in range(n - 1 - i):',
          '            if arr[j] > arr[j + 1]:',
          '                arr[j], arr[j + 1] = arr[j + 1], arr[j]',
          '    return arr',
          '```',
          '',
          '> 发布更新：在编辑器里写完后点「复制笔记数据」，存成 `library.json`，',
          '> 运行 `node tools/build.mjs --library library.json` 再推送即可。',
        ].join('\n'),
      },
    ],
  }],
  activeBar: 'main',
};

const payload = 'window.PUBLISHED_LIBRARY=' + JSON.stringify(library).replace(/</g, '\\u003c') + ';\n';
writeFileSync(path.join(root, 'published-data.js'), payload, 'utf8');
console.log('published-data.js written (' + payload.length + ' bytes)');
