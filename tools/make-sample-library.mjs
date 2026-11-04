// Generates a small sample library.json for build verification.
// Usage: node tools/make-sample-library.mjs
import { writeFileSync } from 'node:fs';

const code = [
  'def bubble_sort(arr):',
  '    n = len(arr)',
  '    for i in range(n - 1):',
  '        for j in range(n - 1 - i):',
  '            if arr[j] > arr[j + 1]:',
  '                arr[j], arr[j + 1] = arr[j + 1], arr[j]',
  '    return arr',
].join('\n');

const library = {
  bars: [{
    id: 'main',
    name: '学习笔记',
    groups: ['开始', '数据结构与算法'],
    posts: [
      {
        id: 'welcome',
        group: '开始',
        title: '欢迎来到学习笔记',
        md: '# 欢迎来到学习笔记\n\n这里是你的个人知识库。\n\n- 左侧分类可展开\n- 新建笔记、导入 Markdown\n- 内容自动保存在浏览器\n',
      },
      {
        id: 'bubble',
        group: '数据结构与算法',
        title: '冒泡排序',
        md: '# 冒泡排序\n\n每一轮把最大的元素冒到末尾。\n\n```python\n' + code + '\n```\n\n> 下一轮只需比较到 `n - 1 - i`。\n',
      },
    ],
  }],
  activeBar: 'main',
};

writeFileSync('library.json', JSON.stringify(library, null, 2));
console.log('library.json written');
