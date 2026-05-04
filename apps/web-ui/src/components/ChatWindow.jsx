import React, { useState } from 'react';
import { askBot } from '../services/api';
export default function ChatWindow(){
const [m,setM]=useState('')
const [msgs,setMsgs]=useState([{role:'bot',text:'Welcome to AURA'}])
async function send(){
 const ans=await askBot(m)
 setMsgs([...msgs,{role:'user',text:m},{role:'bot',text:ans}])
}
return <div className='chat'>
{msgs.map((x,i)=><div key={i}><b>{x.role}</b>: {x.text}</div>)}
<br/>
<input placeholder='Ask leave policy...' onChange={e=>setM(e.target.value)} />
<button onClick={send}>Send</button>
</div>}
