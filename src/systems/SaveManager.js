export function createSave(storage = globalThis.localStorage) {
const Save={
  key:'mamaPutRush3D.v1', d:null,
  defaults(){return{coins:120,unlocked:1,stars:{},best:{},up:{fast:0,patience:0,tips:0,time:0},outfits:['classic'],outfit:'classic',decor:[],
    sound:true,music:true,quality:'high',endlessBest:0,lastClaim:'',streak:0,dailyDone:'',tutorialDone:false};},
  load(){let d=null;try{d=JSON.parse(storage.getItem(this.key));}catch(e){}
    this.d=Object.assign(this.defaults(),d||{});this.d.up=Object.assign(this.defaults().up,this.d.up||{});},
  save(){try{storage.setItem(this.key,JSON.stringify(this.d));}catch(e){}}
};

return Save;
}
