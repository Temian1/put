export function createAudio(Save) {
const Sound={
  ctx:null,step:0,nextT:0,
  init(){
    if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return;}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    try{this.ctx=new AC();}catch(e){return;}
    const c=this.ctx;
    this.master=c.createGain();this.master.gain.value=.7;this.master.connect(c.destination);
    this.sfx=c.createGain();this.sfx.gain.value=.85;this.sfx.connect(this.master);
    this.mus=c.createGain();this.mus.gain.value=Save.d.music?.2:0;this.mus.connect(this.master);
    const len=Math.floor(c.sampleRate*.5);this.nbuf=c.createBuffer(1,len,c.sampleRate);
    const ch=this.nbuf.getChannelData(0);for(let i=0;i<len;i++)ch[i]=Math.random()*2-1;
    this.nextT=c.currentTime+.1;
  },
  tone(f,d,type,v,f2,at,dest){
    const c=this.ctx;if(!c)return;at=at||c.currentTime;
    const o=c.createOscillator(),g=c.createGain();o.type=type||'sine';
    o.frequency.setValueAtTime(f,at);if(f2)o.frequency.exponentialRampToValueAtTime(f2,at+d);
    g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(v||.2,at+.012);g.gain.exponentialRampToValueAtTime(.0001,at+d);
    o.connect(g);g.connect(dest||this.sfx);o.start(at);o.stop(at+d+.05);
  },
  noise(d,v,freq,at,dest,ftype){
    const c=this.ctx;if(!c)return;at=at||c.currentTime;
    const s=c.createBufferSource();s.buffer=this.nbuf;const f=c.createBiquadFilter();f.type=ftype||'highpass';f.frequency.value=freq||3000;
    const g=c.createGain();g.gain.setValueAtTime(v,at);g.gain.exponentialRampToValueAtTime(.0001,at+d);
    s.connect(f);f.connect(g);g.connect(dest||this.sfx);s.start(at);s.stop(at+d+.02);
  },
  seq(notes,gap,type,v,d){const t=this.ctx.currentTime;notes.forEach((f,i)=>this.tone(f,d||.15,type,v,null,t+i*gap));},
  play(n){
    if(!this.ctx||!Save.d.sound)return;
    switch(n){
      case 'tap':this.tone(480,.1,'sine',.25,900);this.noise(.05,.06,5000);break;
      case 'place':this.tone(760,.08,'triangle',.18,1100);break;
      case 'serve':this.seq([660,880,1320],.07,'triangle',.18,.16);break;
      case 'coin':this.seq([1320,1760],.06,'square',.05,.12);break;
      case 'wrong':this.tone(230,.25,'sawtooth',.12,140);break;
      case 'lose':this.seq([392,262],.18,'triangle',.18,.3);break;
      case 'arrive':this.seq([988,1319],.08,'sine',.1,.18);break;
      case 'combo':this.seq([784,988,1175,1568],.05,'square',.06,.12);break;
      case 'win':this.seq([523,659,784,1047,784,1047],.12,'triangle',.2,.24);break;
      case 'fail':this.seq([392,349,311,262],.16,'triangle',.18,.3);break;
      case 'star':this.tone(1047,.3,'sine',.2,2093);break;
      case 'buy':this.seq([523,784,1047],.06,'square',.08,.14);break;
      case 'click':this.tone(620,.06,'sine',.14,480);break;
      case 'go':this.tone(523,.15,'square',.1);this.tone(784,.32,'square',.1,null,this.ctx.currentTime+.15);break;
      case 'tick':this.tone(1400,.04,'square',.05);break;
    }
  },
  setMusic(on){if(this.mus)this.mus.gain.setTargetAtTime(on?.2:0,this.ctx.currentTime,.25);},
  tick(){
    const c=this.ctx;if(!c)return;
    if(!Save.d.music||c.state!=='running'||document.hidden){this.nextT=c.currentTime+.05;return;}
    const spb=60/108/4;
    if(this.nextT<c.currentTime-.2)this.nextT=c.currentTime+.05;
    while(this.nextT<c.currentTime+.15){this.beat(this.step,this.nextT);this.nextT+=spb;this.step++;}
  },
  MEL:[[0,null,7,null,9,null,7,12,null,9,7,null,4,null,2,null],[9,null,null,7,9,null,12,null,9,null,7,null,4,null,null,null],
       [5,null,9,null,12,null,9,null,7,null,5,null,4,null,2,null],[7,null,null,4,7,null,9,null,7,null,4,null,2,null,4,null]],
  beat(s,t){
    const st=s%16,bar=Math.floor(s/16)%4,m=this.mus,mtof=n=>440*Math.pow(2,(n-69)/12);
    const roots=[48,45,41,43];
    if([0,6,8,14].includes(st))this.tone(120,.18,'sine',.55,45,t,m);
    this.noise(.03,st%2?.04:.08,7000,t,m);
    if(st===4||st===12)this.noise(.12,.16,1800,t,m,'bandpass');
    if([0,3,8,11].includes(st))this.tone(mtof(roots[bar]-12+(st===8?7:0)),.22,'triangle',.28,null,t,m);
    const mel=this.MEL[bar][st];
    if(mel!==null){this.tone(mtof(72+mel),.28,'sine',.12,null,t,m);this.tone(mtof(84+mel),.1,'sine',.04,null,t,m);}
  }
};

return Sound;
}
