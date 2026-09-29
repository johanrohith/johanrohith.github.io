const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries)=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});
reveals.forEach(el=>observer.observe(el));

const randomItems = [
  'pages/echoes-of-the-end.html',
  '#builds', '#elsewhere', '#trail', '#beyond', '#next'
];
document.getElementById('randomButton').addEventListener('click',()=>{
  const target = randomItems[Math.floor(Math.random()*randomItems.length)];
  window.location.href = target;
});

const dialog = document.getElementById('whyDialog');
document.getElementById('whyEgg').addEventListener('click',(e)=>{e.preventDefault();dialog.showModal()});
document.getElementById('closeWhy').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',(e)=>{if(e.target===dialog)dialog.close()});

document.querySelectorAll('[data-placeholder]').forEach(link=>link.addEventListener('click',e=>{
  e.preventDefault(); alert(`Add your ${link.dataset.placeholder} profile URL in index.html.`);
}));
