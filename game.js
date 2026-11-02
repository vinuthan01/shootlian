(()=>{
  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
  const stars=document.getElementById('stars'),starCtx=stars.getContext('2d'),aim=document.getElementById('aim');
  const ui={
    score:document.getElementById('score'),kills:document.getElementById('kills'),best:document.getElementById('best'),combo:document.getElementById('combo'),
    level:document.getElementById('level'),lives:document.getElementById('lives'),state:document.getElementById('state'),overlay:document.getElementById('overlay'),
    panelTitle:document.getElementById('panel-title'),panelKicker:document.getElementById('panel-kicker'),panelCopy:document.getElementById('panel-copy'),resume:document.getElementById('resume'),
    pause:document.getElementById('touch-pause'),sound:document.getElementById('sound-toggle'),bossHud:document.getElementById('boss-hud'),bossHealth:document.getElementById('boss-health'),bossText:document.getElementById('boss-health-text'),
    bossLabel:document.getElementById('boss-label'),power:document.getElementById('power-status'),toast:document.getElementById('unlock-toast'),
    mission:document.getElementById('mission-name'),missionProgress:document.getElementById('mission-progress'),upgrades:document.getElementById('upgrade-options')
  };
  let W=innerWidth,H=innerHeight,dpr=1,mouse={x:innerWidth/2,y:innerHeight/2},playerX=innerWidth/2;
  let starsField=[],aliens=[],shots=[],enemyShots=[],particles=[],drops=[],rocks=[],targets=[],boss=null;
  let score=0,kills=0,lives=3,maxLives=3,paused=false,over=false,held=false,upgradePending=false;
  let last=0,spawn=0,lastFire=0,shake=0,combo=0,comboUntil=0,nextBossAt=10,powerType='',powerUntil=0,shieldCharges=0,toastTimer=0,pauseAt=0;
  let mode='play',modeUntil=0,rockSpawn=0,targetSpawn=0,fireRateBonus=0,bossDamageBonus=0,missionIndex=0,mission=null;
  let audioCtx=null,audioMaster=null,musicVoices=[],musicTimer=0,arpTimer=0,chordStep=0,arpStep=0,audioMuted=readMute();
  const powerNames={rapid:'RAPID FIRE',spread:'SPREAD SHOT',shield:'PHASE SHIELD'};
  const skins=[{at:0,name:'EMBER',color:'#ffb46f'},{at:10,name:'CYAN',color:'#75f2ff'},{at:25,name:'VIOLET',color:'#bd8cff'},{at:50,name:'GOLD',color:'#ffe078'}];
  const missionDeck=[
    {kind:'kill',target:'dart',goal:2,label:'DART HUNTER'},
    {kind:'combo',goal:5,label:'BUILD A 5× COMBO'},
    {kind:'collect',goal:1,label:'COLLECT A POWER-UP'},
    {kind:'kill',target:'armored',goal:2,label:'CRACK TWO ARMOR SHELLS'}
  ];
  function readMute(){try{return localStorage.getItem('shootlian-muted')==='true'}catch{return false}}
  function getBest(){try{return Number(localStorage.getItem('shootlian-best')||0)}catch{return 0}}
  let best=getBest();
  function currentSkin(){return [...skins].reverse().find(s=>best>=s.at)||skins[0]}
  function resize(){
    W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);playerX=Math.min(Math.max(playerX,30),W-30);
    for(const c of [canvas,stars]){c.width=W*dpr;c.height=H*dpr;c.style.width=W+'px';c.style.height=H+'px'}
    ctx.setTransform(dpr,0,0,dpr,0,0);starCtx.setTransform(dpr,0,0,dpr,0,0);
    starsField=Array.from({length:Math.floor(W*H/6200)},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.1+.25,a:Math.random()*.48+.12,p:Math.random()*6.28}));
  }
  addEventListener('resize',resize);resize();
  function showToast(message){ui.toast.textContent=message;ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>ui.toast.classList.remove('show'),2200)}
  const chords=[[110,164.81,220],[98,146.83,196],[130.81,196,261.63],[87.31,130.81,174.61]];
  function syncSoundButton(){ui.sound.setAttribute('aria-pressed',String(!audioMuted));ui.sound.setAttribute('aria-label',audioMuted?'Unmute game sound':'Mute game sound');ui.sound.querySelector('.sound-label').textContent=audioMuted?'SOUND OFF':'SOUND ON';ui.sound.querySelector('.sound-icon').textContent=audioMuted?'♫̸':'♫'}
  function startAudio(){
    if(audioMuted)return;const AudioEngine=window.AudioContext||window.webkitAudioContext;if(!AudioEngine)return;
    if(!audioCtx){audioCtx=new AudioEngine();audioMaster=audioCtx.createGain();audioMaster.gain.value=0;audioMaster.connect(audioCtx.destination);
      for(let i=0;i<3;i++){const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.value=chords[0][i];gain.gain.value=[.035,.022,.012][i];osc.connect(gain);gain.connect(audioMaster);osc.start();musicVoices.push(osc)}
      musicTimer=setInterval(()=>{if(!audioCtx||audioMuted)return;chordStep=(chordStep+1)%chords.length;const now=audioCtx.currentTime;musicVoices.forEach((o,i)=>o.frequency.setTargetAtTime(chords[chordStep][i],now,.9))},3600);
      arpTimer=setInterval(()=>{if(audioMuted||!audioCtx||audioCtx.state!=='running')return;const note=chords[chordStep][arpStep%3]*2;arpStep++;playTone(note,.7,'triangle',.055,.97)},720);
    }
    if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});audioMaster.gain.cancelScheduledValues(audioCtx.currentTime);audioMaster.gain.setTargetAtTime(.58,audioCtx.currentTime,.08);
  }
  function playTone(freq,duration=.12,wave='sine',volume=.1,slide=.8){
    if(audioMuted||!audioCtx)return;if(audioCtx.state!=='running'){audioCtx.resume().then(()=>playTone(freq,duration,wave,volume,slide)).catch(()=>{});return}const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type=wave;osc.frequency.setValueAtTime(freq,now);if(slide>0)osc.frequency.exponentialRampToValueAtTime(Math.max(35,freq*slide),now+duration);
    gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(volume,now+Math.min(.018,duration*.25));gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain);gain.connect(audioMaster);osc.start(now);osc.stop(now+duration+.02);
  }
  function sfx(name){if(audioMuted||!audioCtx)return;if(audioCtx.state!=='running'){audioCtx.resume().then(()=>sfx(name)).catch(()=>{});return}
    if(name==='shot')playTone(780,.075,'sawtooth',.08,.4);
    else if(name==='hit')playTone(430+Math.random()*170,.13,'triangle',.13,.42);
    else if(name==='boss-hit')playTone(150,.19,'sawtooth',.15,.35);
    else if(name==='hurt')playTone(185,.24,'triangle',.18,.48);
    else if(name==='near')playTone(880,.16,'sine',.12,1.35);
    else if(name==='rock')playTone(260,.15,'triangle',.11,.38);
    else if(name==='target')playTone(620,.11,'sine',.1,1.4);
    else if(name==='power'){[520,680,880].forEach((n,i)=>setTimeout(()=>playTone(n,.16,'sine',.1,1.15),i*85))}
    else if(name==='boss'){[110,165,220].forEach((n,i)=>setTimeout(()=>playTone(n,.42,'sine',.09,.98),i*100))}
    else if(name==='boss-down'){[440,554,659,880].forEach((n,i)=>setTimeout(()=>playTone(n,.38,'triangle',.11,.98),i*100))}
    else if(name==='mission'){[660,880].forEach((n,i)=>setTimeout(()=>playTone(n,.18,'sine',.1,1.2),i*100))}
    else if(name==='upgrade'){[330,495,660].forEach((n,i)=>setTimeout(()=>playTone(n,.22,'triangle',.11,1.1),i*90))}
  }
  function updateBest(){
    if(score<=best)return;const oldSkin=currentSkin();best=score;ui.best.textContent=String(best).padStart(3,'0');
    try{localStorage.setItem('shootlian-best',String(best))}catch{}
    const newSkin=currentSkin();if(newSkin.name!==oldSkin.name)showToast('NEW SHOT STYLE UNLOCKED · '+newSkin.name);
  }
  function drawStars(t){starCtx.clearRect(0,0,W,H);for(const s of starsField){starCtx.globalAlpha=s.a*(.72+.28*Math.sin(t*.0008+s.p));starCtx.fillStyle='#d1def1';starCtx.beginPath();starCtx.arc(s.x,s.y,s.r,0,Math.PI*2);starCtx.fill()}starCtx.globalAlpha=1}
  function setMission(){mission=missionDeck[missionIndex%missionDeck.length];mission={...mission,progress:0};ui.mission.textContent=mission.label;ui.missionProgress.textContent='0 / '+mission.goal}
  function missionStep(kind,detail){
    if(!mission||mission.kind!==kind||(kind==='kill'&&mission.target!==detail))return;
    mission.progress++;ui.missionProgress.textContent=Math.min(mission.progress,mission.goal)+' / '+mission.goal;
    if(mission.progress>=mission.goal){mission=null;score+=50;updateBest();updateHud();showToast('SIDE MISSION COMPLETE · +50');sfx('mission');missionIndex++;setTimeout(()=>{if(!over)setMission()},1800)}
  }
  function makeAlien(){
    const roll=Math.random(),type=roll<.24?'dart':roll<.44?'armored':'scout';
    const r=type==='dart'?15+Math.random()*3:type==='armored'?24+Math.random()*4:19+Math.random()*7;
    return{x:38+Math.random()*Math.max(10,W-76),y:-48,r,type,hp:type==='armored'?2:1,
      speed:(type==='dart'?92:type==='armored'?31:48)+Math.random()*18+Math.floor(kills/5)*8,
      phase:Math.random()*6.28,hue:type==='dart'?45:type==='armored'?282:[164,190,330][Math.floor(Math.random()*3)],wobble:type==='dart'?78:type==='armored'?10:27};
  }
  function alienPosition(a,t){a.cx=a.x+Math.sin(t*(a.type==='dart'?.0035:.0015)+a.phase)*a.wobble;a.cy=a.y+Math.sin(t*.003+a.phase)*4;return[a.cx,a.cy]}
  function drawAlien(a,t){
    const [x,y]=alienPosition(a,t),r=a.r;ctx.save();ctx.translate(x,y);ctx.shadowBlur=23;ctx.shadowColor=`hsla(${a.hue},90%,60%,.6)`;
    for(let i=-2;i<=2;i++){const tx=i*r*.28;ctx.beginPath();ctx.moveTo(tx,r*.46);ctx.bezierCurveTo(tx+i*4,r*.78,tx+i*5+Math.sin(t*.01+i+a.phase)*3,r*1.05,tx+i*4,r*1.26);ctx.strokeStyle=`hsla(${a.hue},72%,55%,.9)`;ctx.lineWidth=Math.max(2,r*.12);ctx.lineCap='round';ctx.stroke()}
    const grad=ctx.createRadialGradient(-r*.28,-r*.4,2,0,0,r*1.25);grad.addColorStop(0,`hsl(${a.hue},88%,78%)`);grad.addColorStop(.45,`hsl(${a.hue},72%,51%)`);grad.addColorStop(1,`hsl(${a.hue},65%,24%)`);
    ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(0,0,r*.85,r*.68,0,0,Math.PI*2);ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle=`hsla(${a.hue},95%,83%,.8)`;ctx.stroke();
    if(a.type==='dart'){ctx.fillStyle='#fff1a8';ctx.beginPath();ctx.moveTo(0,-r*.92);ctx.lineTo(r*.35,-r*.62);ctx.lineTo(0,-r*.48);ctx.lineTo(-r*.35,-r*.62);ctx.closePath();ctx.fill()}
    for(const ex of [-r*.29,r*.29]){ctx.fillStyle='#101725';ctx.beginPath();ctx.ellipse(ex,-r*.06,r*.2,r*.27,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e4fbff';ctx.beginPath();ctx.ellipse(ex-r*.035,-r*.1,r*.105,r*.16,-.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex-r*.07,-r*.17,r*.045,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle=`hsla(${a.hue},100%,92%,.85)`;ctx.beginPath();ctx.arc(0,r*.36,r*.07,0,Math.PI*2);ctx.fill();
    if(a.type==='armored'){ctx.beginPath();ctx.ellipse(0,0,r*1.02,r*.82,0,Math.PI,Math.PI*2);ctx.strokeStyle='rgba(229,216,255,.88)';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#fff';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText('2',0,r+14)}ctx.restore();
  }
  function spawnBoss(now){const hp=13+Math.floor(kills/20)*3;boss={x:W/2,y:Math.max(125,H*.22),r:47,hp,maxHp:hp,dir:1,nextAttack:now+1350,phase:Math.random()*6};ui.bossHud.classList.add('show');ui.bossLabel.textContent='SECTOR '+String(Math.floor(kills/10)).padStart(2,'0')+' · OVERLORD';ui.state.textContent='BOSS INBOUND';showToast('BOSS INBOUND · WATCH FOR THE VOLLEY');sfx('boss')}
  function drawBoss(b,t){
    const r=b.r;ctx.save();ctx.translate(b.x,b.y+Math.sin(t*.002+b.phase)*5);ctx.shadowBlur=34;ctx.shadowColor='rgba(255,75,113,.8)';
    for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*r*.52,-r*.48);ctx.quadraticCurveTo(side*r*1.18,-r*1.05,side*r*.87,-r*.18);ctx.strokeStyle='#ff687d';ctx.lineWidth=8;ctx.lineCap='round';ctx.stroke();ctx.beginPath();ctx.moveTo(side*r*.2,r*.65);ctx.quadraticCurveTo(side*r*.4,r*1.12,side*r*.67,r*1.16);ctx.strokeStyle='#a93367';ctx.lineWidth=7;ctx.stroke()}
    const grad=ctx.createRadialGradient(-r*.3,-r*.4,2,0,0,r*1.3);grad.addColorStop(0,'#ffd2c6');grad.addColorStop(.3,'#ff687d');grad.addColorStop(.72,'#9e285e');grad.addColorStop(1,'#321a42');ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(0,0,r,r*.76,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(255,220,222,.85)';ctx.lineWidth=2;ctx.stroke();
    for(const ex of [-r*.36,0,r*.36]){ctx.fillStyle='#260f2d';ctx.beginPath();ctx.ellipse(ex,-r*.08,r*.17,r*.24,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff1da';ctx.shadowColor='#ffdfbd';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(ex,-r*.1,r*.085,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle='#ffcad4';ctx.beginPath();ctx.moveTo(-r*.28,r*.36);ctx.lineTo(0,r*.57);ctx.lineTo(r*.28,r*.36);ctx.closePath();ctx.fill();ctx.restore();
  }
  function burst(x,y,color,count=18){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=35+Math.random()*220;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.35+Math.random()*.5,max:.85,size:1.5+Math.random()*4,color})}}
  function fireShot(){
    if(paused||over)return;const now=performance.now(),rapid=powerType==='rapid'&&now<powerUntil,spread=powerType==='spread'&&now<powerUntil;if(now-lastFire<(rapid?64:Math.max(82,140*(1-fireRateBonus))))return;lastFire=now;
    const ox=playerX,oy=H-65,dx=mouse.x-ox,dy=mouse.y-oy,len=Math.hypot(dx,dy)||1,base=Math.atan2(dy,dx),skin=currentSkin();
    const angles=spread?[-.2,0,.2]:[0];for(const offset of angles){const a=base+offset;shots.push({x:ox,y:oy,vx:Math.cos(a)*920,vy:Math.sin(a)*920,life:1.55,color:skin.color,damage:1+bossDamageBonus})}burst(ox,oy,skin.color,rapid?2:4);sfx('shot');
  }
  function updateHud(now=performance.now()){
    ui.score.textContent=String(score).padStart(3,'0');ui.kills.textContent=String(kills).padStart(3,'0');ui.best.textContent=String(best).padStart(3,'0');ui.level.textContent=String(1+Math.floor(kills/5)).padStart(2,'0');
    ui.lives.textContent=Array.from({length:maxLives},(_,i)=>i<lives?'♥':'·').join(' ');ui.combo.textContent=combo>1?'×'+(1+Math.floor((combo-1)/5))+' / '+combo:'—';
    if(powerType&&now<powerUntil)ui.power.textContent=powerNames[powerType]+(powerType==='shield'?' · '+shieldCharges+' CHARGE'+(shieldCharges===1?'':'S'):'')+' · '+Math.ceil((powerUntil-now)/1000)+'s';else if(shieldCharges>0)ui.power.textContent='PHASE SHIELD · '+shieldCharges+' CHARGE'+(shieldCharges===1?'':'S');else ui.power.textContent='';
    if(boss){ui.bossHealth.style.width=(100*boss.hp/boss.maxHp)+'%';ui.bossText.textContent=Math.ceil(100*boss.hp/boss.maxHp)+'%'}
  }
  function applyPower(type,now){if(type==='shield'){powerType='shield';powerUntil=now+11000;shieldCharges=Math.min(2,shieldCharges+1)}else{powerType=type;powerUntil=now+9000}ui.state.textContent=powerNames[type]+' ACQUIRED';showToast(powerNames[type]+' · '+(type==='shield'?'BLOCK A HIT':'BOOST ACTIVE'));sfx('power');missionStep('collect',type);updateHud(now)}
  function takeHit(x,y,now){
    if(powerType==='shield'&&now<powerUntil&&shieldCharges>0){shieldCharges--;if(shieldCharges===0){powerType='';powerUntil=0}burst(x,y,'#83f4ff',24);showToast('PHASE SHIELD ABSORBED HIT');sfx('power');shake=6;return}
    lives--;combo=0;sfx('hurt');burst(x,y,'#ff637c',26);shake=11;if(lives<=0){updateHud(now);endGame()}
  }
  function addScore(points){score+=points;updateBest();updateHud()}
  function awardKill(a,now){
    kills++;combo=now<comboUntil?combo+1:1;comboUntil=now+2700;score+=1+Math.floor((combo-1)/5);updateBest();updateHud(now);burst(a.cx,a.cy,`hsl(${a.hue},90%,68%)`,27);sfx('hit');shake=Math.max(shake,3+Math.floor(combo/4));missionStep('kill',a.type);missionStep('combo',combo);
    if(Math.random()<.22)drops.push({x:a.cx,y:a.cy,r:12,type:['rapid','spread','shield'][Math.floor(Math.random()*3)],phase:Math.random()*6});if(kills>=nextBossAt&&!boss){nextBossAt+=10;spawnBoss(now)}
  }
  function createUpgrades(){
    const choices=[
      {id:'overdrive',title:'OVERDRIVE COIL',desc:'Fire 20% faster for the rest of this run.'},
      {id:'charged',title:'CHARGED ROUNDS',desc:'Deal +1 damage to every boss shot.'},
      {id:'repair',title:'REINFORCED HULL',desc:'Restore one shield and add one max shield.'}
    ].sort(()=>Math.random()-.5).slice(0,2);ui.upgrades.replaceChildren();ui.upgrades.classList.add('show');ui.resume.style.display='none';
    for(const item of choices){const button=document.createElement('button');button.type='button';button.className='upgrade-choice';button.dataset.upgrade=item.id;button.innerHTML='<strong>'+item.title+'</strong><small>'+item.desc+'</small>';ui.upgrades.append(button)}
  }
  function presentUpgrades(){upgradePending=true;paused=true;held=false;ui.overlay.classList.add('show');ui.panelKicker.textContent='OVERLORD DEFEATED';ui.panelTitle.textContent='Choose your upgrade.';ui.panelCopy.textContent='Pick one system to carry into the next sector.';createUpgrades()}
  function chooseUpgrade(id){
    if(id==='overdrive')fireRateBonus=Math.min(.55,fireRateBonus+.2);if(id==='charged')bossDamageBonus++;
    if(id==='repair'){maxLives=Math.min(5,maxLives+1);lives=Math.min(maxLives,lives+1)}
    ui.upgrades.classList.remove('show');ui.upgrades.replaceChildren();ui.resume.style.display='';ui.overlay.classList.remove('show');upgradePending=false;paused=false;updateHud();showToast('SYSTEM UPGRADE INSTALLED');sfx('upgrade');startBonusRound(performance.now());
  }
  function startBonusRound(now){mode='bonus';modeUntil=now+7600;targetSpawn=0;targets=[];ui.state.textContent='BONUS ROUND';showToast('BONUS ROUND · SHOOT THE DRONES')}
  function startAsteroidWave(now){mode='asteroids';modeUntil=now+7600;rockSpawn=0;rocks=[];ui.state.textContent='ASTEROID FIELD';showToast('ASTEROID WAVE · MOVE SIDE TO SIDE OR BLAST THROUGH')}
  function finishBoss(dead,now){boss=null;ui.bossHud.classList.remove('show');aliens=[];enemyShots=[];drops=[];score+=100;updateBest();updateHud(now);burst(dead.x,dead.y,'#ff718f',85);shake=17;missionStep('boss');ui.state.textContent='SECTOR CLEARED';showToast('OVERLORD DEFEATED · +100 BONUS');sfx('boss-down');presentUpgrades()}
  function handleShotCollisions(now){
    for(let i=shots.length-1;i>=0;i--){const b=shots[i];b.x+=b.vx*(Math.min(1/30,.04));b.y+=b.vy*(Math.min(1/30,.04));b.life-=Math.min(1/30,.04)}
  }
  function update(dt,now){
    if(paused||over)return;
    if(held)fireShot();playerX+=(Math.max(28,Math.min(W-28,mouse.x))-playerX)*Math.min(1,dt*8);
    if(combo&&now>comboUntil){combo=0;if(mission?.kind==='combo'){mission.progress=0;ui.missionProgress.textContent='0 / '+mission.goal}updateHud(now)}
    if(powerType&&now>powerUntil){powerType='';powerUntil=0;shieldCharges=0;ui.power.textContent='';ui.state.textContent=boss?'BOSS FIGHT':mode==='play'?'DEFENSE SYSTEM ONLINE':mode==='bonus'?'BONUS ROUND':'ASTEROID FIELD'}
    if(mode==='play'){
      spawn+=dt;const rate=Math.max(.38,1.05-Math.floor(kills/5)*.105);if(!boss&&spawn>rate){spawn=0;aliens.push(makeAlien());if(kills>=10&&Math.random()<.12)aliens.push(makeAlien())}
      for(let i=aliens.length-1;i>=0;i--){const a=aliens[i];a.y+=a.speed*dt;alienPosition(a,now);if(a.y>H-92){aliens.splice(i,1);takeHit(a.cx,H-84,now)}}
      if(boss){boss.x+=boss.dir*(84+Math.floor(kills/20)*11)*dt;if(boss.x>W-boss.r-20){boss.x=W-boss.r-20;boss.dir=-1}if(boss.x<boss.r+20){boss.x=boss.r+20;boss.dir=1}if(now>boss.nextAttack){boss.nextAttack=now+1850;const ox=boss.x,oy=boss.y+boss.r*.55,tx=playerX,ty=H-55,base=Math.atan2(ty-oy,tx-ox);for(const off of [-.22,0,.22])enemyShots.push({x:ox,y:oy,vx:Math.cos(base+off)*250,vy:Math.sin(base+off)*250,grazed:false})}}
    }else if(mode==='bonus'){
      targetSpawn+=dt;if(targetSpawn>.72){targetSpawn=0;targets.push({x:45+Math.random()*Math.max(20,W-90),y:145+Math.random()*Math.max(25,H*.33),r:15+Math.random()*5,vx:(Math.random()>.5?1:-1)*(70+Math.random()*60),phase:Math.random()*6,life:5})}
      for(let i=targets.length-1;i>=0;i--){const a=targets[i];a.x+=a.vx*dt;a.y+=Math.sin(now*.003+a.phase)*15*dt;a.life-=dt;if(a.x<a.r||a.x>W-a.r)a.vx*=-1;if(a.life<=0)targets.splice(i,1)}
      if(now>=modeUntil){targets=[];startAsteroidWave(now)}
    }else if(mode==='asteroids'){
      rockSpawn+=dt;if(rockSpawn>.34){rockSpawn=0;rocks.push({x:25+Math.random()*Math.max(20,W-50),y:-35,r:13+Math.random()*16,vx:(Math.random()-.5)*125,vy:175+Math.random()*110,rot:Math.random()*6,spin:(Math.random()-.5)*2})}
      for(let i=rocks.length-1;i>=0;i--){const r=rocks[i];r.x+=r.vx*dt;r.y+=r.vy*dt;r.rot+=r.spin*dt;if(r.y>H-73&&Math.abs(r.x-playerX)<r.r+21){rocks.splice(i,1);takeHit(playerX,H-61,now)}else if(r.y>H+50)rocks.splice(i,1)}
      if(now>=modeUntil){rocks=[];mode='play';spawn=0;ui.state.textContent='DEFENSE SYSTEM ONLINE';showToast('SECTOR RESUMED · KEEP THE STREAK ALIVE')}
    }
    for(let i=drops.length-1;i>=0;i--){const d=drops[i];d.y+=38*dt;if(Math.hypot(mouse.x-d.x,mouse.y-d.y)<d.r+16){applyPower(d.type,now);burst(d.x,d.y,d.type==='shield'?'#83f4ff':d.type==='rapid'?'#ffcc67':'#bd8cff',18);drops.splice(i,1)}else if(d.y>H-90)drops.splice(i,1)}
    for(let i=enemyShots.length-1;i>=0;i--){const b=enemyShots[i];const oldY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;const dy=Math.abs(b.y-(H-61)),dx=Math.abs(b.x-playerX);
      if(!b.grazed&&b.y>H-132&&b.y<H-67&&dx>26&&dx<72){b.grazed=true;combo=now<comboUntil?combo+1:Math.max(1,combo);comboUntil=now+2700;score+=5;missionStep('combo',combo);updateBest();updateHud(now);showToast('NEAR MISS · +5 POINTS');sfx('near');burst(b.x,b.y,'#8cf4ff',9)}
      if(b.y>H-60&&dx<27){enemyShots.splice(i,1);takeHit(playerX,H-60,now)}else if(b.x<-40||b.x>W+40||b.y>H+40)enemyShots.splice(i,1);
    }
    for(let i=shots.length-1;i>=0;i--){const b=shots[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||b.x<-30||b.x>W+30||b.y<-30||b.y>H+30){shots.splice(i,1);continue}let hit=false;
      if(boss&&Math.hypot(b.x-boss.x,b.y-boss.y)<boss.r+5){shots.splice(i,1);boss.hp-=b.damage;burst(b.x,b.y,'#ffc0cc',5);sfx('boss-hit');if(boss.hp<=0)finishBoss(boss,now);continue}
      for(let j=aliens.length-1;j>=0;j--){const a=aliens[j];if(Math.hypot(b.x-a.cx,b.y-a.cy)<a.r+5){shots.splice(i,1);a.hp--;if(a.hp<=0){aliens.splice(j,1);awardKill(a,now)}else{burst(a.cx,a.cy,'#e8dcff',8);shake=2}hit=true;break}}
      if(hit)continue;
      if(mode==='bonus'){for(let j=targets.length-1;j>=0;j--){const a=targets[j];if(Math.hypot(b.x-a.x,b.y-a.y)<a.r+5){shots.splice(i,1);targets.splice(j,1);addScore(15);sfx('target');burst(a.x,a.y,'#8df7ff',20);continue}}}
      if(mode==='asteroids'){for(let j=rocks.length-1;j>=0;j--){const r=rocks[j];if(Math.hypot(b.x-r.x,b.y-r.y)<r.r+4){shots.splice(i,1);rocks.splice(j,1);addScore(3);sfx('rock');burst(r.x,r.y,'#b8c4ce',13);break}}}
    }
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.08,dt);p.vy*=Math.pow(.08,dt);p.life-=dt;if(p.life<=0)particles.splice(i,1)}
    updateHud(now);
  }
  function drawRock(r){ctx.save();ctx.translate(r.x,r.y);ctx.rotate(r.rot);ctx.shadowBlur=9;ctx.shadowColor='rgba(185,211,238,.25)';ctx.fillStyle='#667789';ctx.strokeStyle='#bac8d2';ctx.lineWidth=1.4;ctx.beginPath();for(let i=0;i<9;i++){const a=i*Math.PI*2/9,rr=r.r*(.78+((i*17)%5)/20);const x=Math.cos(a)*rr,y=Math.sin(a)*rr;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='rgba(23,36,51,.5)';ctx.beginPath();ctx.arc(-r.r*.18,-r.r*.15,r.r*.2,0,Math.PI*2);ctx.fill();ctx.restore()}
  function drawTarget(a,t){ctx.save();ctx.translate(a.x,a.y);ctx.rotate(t*.001);ctx.shadowBlur=23;ctx.shadowColor='#72f4ff';ctx.strokeStyle='#a6fbff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,a.r,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,a.r*.55,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#eaffff';ctx.beginPath();ctx.arc(0,0,3,0,Math.PI*2);ctx.fill();ctx.restore()}
  function draw(now){
    ctx.clearRect(0,0,W,H);ctx.save();if(shake>.1){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.87}
    const oy=H-65;ctx.save();ctx.setLineDash([3,10]);ctx.strokeStyle='rgba(177,202,232,.09)';ctx.beginPath();ctx.moveTo(playerX,oy);ctx.lineTo(mouse.x,mouse.y);ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=22;ctx.shadowColor=currentSkin().color;ctx.fillStyle='#26394e';ctx.beginPath();ctx.roundRect(playerX-23,oy+15,46,24,8);ctx.fill();ctx.fillStyle='#d5dbe0';ctx.beginPath();ctx.roundRect(playerX-8,oy-5,16,25,5);ctx.fill();ctx.fillStyle=currentSkin().color;ctx.beginPath();ctx.arc(playerX,oy,4,0,Math.PI*2);ctx.fill();ctx.restore();
    if(powerType==='shield'&&now<powerUntil&&shieldCharges){ctx.beginPath();ctx.arc(playerX,oy,42,0,Math.PI*2);ctx.strokeStyle='rgba(116,240,255,.75)';ctx.lineWidth=2;ctx.shadowBlur=22;ctx.shadowColor='#71efff';ctx.stroke()}
    for(const a of aliens)drawAlien(a,now);if(boss)drawBoss(boss,now);for(const r of rocks)drawRock(r);for(const a of targets)drawTarget(a,now);
    for(const d of drops){ctx.save();ctx.translate(d.x,d.y);ctx.rotate(now*.001+d.phase);const color=d.type==='shield'?'#7cf2ff':d.type==='rapid'?'#ffca65':'#be8cff';ctx.shadowBlur=17;ctx.shadowColor=color;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-d.r);ctx.lineTo(d.r*.75,0);ctx.lineTo(0,d.r);ctx.lineTo(-d.r*.75,0);ctx.closePath();ctx.fill();ctx.fillStyle='#152030';ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(d.type==='shield'?'S':d.type==='rapid'?'R':'3',0,0);ctx.restore()}
    for(const b of shots){ctx.save();ctx.shadowBlur=20;ctx.shadowColor=b.color;ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(b.x-b.vx*.025,b.y-b.vy*.025);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore()}
    for(const b of enemyShots){ctx.save();ctx.shadowBlur=18;ctx.shadowColor='#ff5270';ctx.fillStyle='#ff7890';ctx.beginPath();ctx.arc(b.x,b.y,5,0,Math.PI*2);ctx.fill();ctx.restore()}
    for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.shadowBlur=12;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;ctx.restore();
  }
  function frame(t){const dt=Math.min((t-last)/1000||0,.04);last=t;drawStars(t);update(dt,t);draw(t);requestAnimationFrame(frame)}requestAnimationFrame(frame);
  function togglePause(){if(over||upgradePending)return;paused=!paused;if(paused){pauseAt=performance.now();held=false}else{const delta=performance.now()-pauseAt;if(comboUntil)comboUntil+=delta;if(powerUntil)powerUntil+=delta;if(modeUntil)modeUntil+=delta;if(boss)boss.nextAttack+=delta}ui.overlay.classList.toggle('show',paused);ui.state.textContent=paused?'MISSION PAUSED':boss?'BOSS FIGHT':mode==='play'?'DEFENSE SYSTEM ONLINE':mode==='bonus'?'BONUS ROUND':'ASTEROID FIELD';ui.panelKicker.textContent='MISSION PAUSED';ui.panelTitle.textContent='Hold your fire.';ui.panelCopy.innerHTML=`Score: ${score} · Kills: ${kills}<br>Your mission is waiting.`;ui.upgrades.classList.remove('show');ui.resume.style.display='';ui.resume.textContent='RESUME MISSION'}
  function endGame(){over=true;held=false;paused=false;ui.overlay.classList.add('show');ui.state.textContent='SIGNAL LOST';ui.panelKicker.textContent='MISSION OVER';ui.panelTitle.textContent='They got through.';ui.panelCopy.innerHTML=`${kills} aliens defeated.<br>Score: ${score} · Best: ${best}`;ui.upgrades.classList.remove('show');ui.resume.style.display='';ui.resume.textContent='PLAY AGAIN'}
  function restart(){aliens=[];shots=[];enemyShots=[];particles=[];drops=[];rocks=[];targets=[];boss=null;score=0;kills=0;lives=3;maxLives=3;combo=0;comboUntil=0;nextBossAt=10;spawn=0;held=false;paused=false;over=false;upgradePending=false;mode='play';modeUntil=0;powerType='';powerUntil=0;shieldCharges=0;fireRateBonus=0;bossDamageBonus=0;ui.bossHud.classList.remove('show');ui.upgrades.classList.remove('show');ui.upgrades.replaceChildren();ui.resume.style.display='';ui.overlay.classList.remove('show');ui.state.textContent='DEFENSE SYSTEM ONLINE';missionIndex=0;setMission();updateHud()}
  syncSoundButton();ui.sound.addEventListener('click',()=>{audioMuted=!audioMuted;try{localStorage.setItem('shootlian-muted',String(audioMuted))}catch{}syncSoundButton();if(audioMuted&&audioMaster){audioMaster.gain.cancelScheduledValues(audioCtx.currentTime);audioMaster.gain.setTargetAtTime(0,audioCtx.currentTime,.04)}else startAudio()});
  ui.resume.addEventListener('click',()=>over?restart():togglePause());ui.pause.addEventListener('click',togglePause);
  ui.upgrades.addEventListener('click',e=>{const button=e.target.closest('[data-upgrade]');if(button)chooseUpgrade(button.dataset.upgrade)});
  addEventListener('pointermove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;aim.style.left=mouse.x+'px';aim.style.top=mouse.y+'px'});
  addEventListener('pointerdown',e=>{if(e.target.closest('button,input,form'))return;if(e.button===0){startAudio();mouse.x=e.clientX;mouse.y=e.clientY;held=true;fireShot()}if(e.button===2)togglePause()});
  addEventListener('pointerup',()=>held=false);addEventListener('pointercancel',()=>held=false);addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;if(e.code==='Space'){e.preventDefault();startAudio();held=true;fireShot()}if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();held=false;togglePause()}});addEventListener('keyup',e=>{if(e.code==='Space')held=false});
  setMission();updateHud();
})();

