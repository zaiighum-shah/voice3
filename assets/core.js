const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
function applyTheme(t){document.documentElement.dataset.theme=t;localStorage.setItem("voxora-theme",t);const b=$("#themeToggle");if(b)b.textContent=t==="dark"?"☀":"☾"}
function initTheme(){applyTheme(localStorage.getItem("voxora-theme")||"dark");$("#themeToggle")?.addEventListener("click",()=>applyTheme(document.documentElement.dataset.theme==="dark"?"light":"dark"))}
async function getSession(){if(!window.voxoraSupabase)return null;return (await window.voxoraSupabase.auth.getSession()).data.session}
async function requireAuth(){const s=await getSession();if(!s){sessionStorage.setItem("voxora-return",location.pathname+location.search);location.href="login.html";return null}return s}
function setUserUI(s){const e=$("#userMenu");if(!e)return;if(s?.user){const x=s.user.email||"";e.innerHTML=`<span class="avatar">${x[0]?.toUpperCase()||"U"}</span><button class="btn small secondary" id="logoutBtn">Log out</button>`;$("#logoutBtn").onclick=async()=>{await window.voxoraSupabase?.auth.signOut();location.href="index.html"}}}
async function initHeader(){initTheme();setUserUI(await getSession())}
document.addEventListener("DOMContentLoaded",initHeader)
