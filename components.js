/* UI primitives shared by the directory, reader and editor. */
window.BlogUI={
 icons(){window.lucide?.createIcons({attrs:{'stroke-width':1.6}})},
 enhanceDirectory(){document.querySelectorAll('#navigation summary').forEach(s=>{const text=s.firstChild;if(text?.nodeType===3)text.textContent=text.textContent.replace(/ · \d+$/,'');});this.icons()},
 setEditing(open){document.body.classList.toggle('editing',open);document.querySelector('#edit').textContent=open?'完成编辑':'编辑笔记'},
 init(){this.icons();document.querySelector('#toggle-sidebar').onclick=()=>document.body.classList.toggle('sidebar-hidden');document.querySelector('#search').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('#navigation details').forEach(d=>{let found=false;d.querySelectorAll('.tree-row').forEach(r=>{const match=r.textContent.toLowerCase().includes(q);r.hidden=!match;found ||=match});d.hidden=!!q&&!found;if(q&&found)d.open=true})});}
};
