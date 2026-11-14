import { useState } from 'react'
import './App.css'

const items = [
  ['campus', 'Mon campus', 'm3 10 9-7 9 7v11h-6v-7H9v7H3Z'],
  ['horaire', 'Horaire et bus', 'M4 17V5q0-2 2-2h12q2 0 2 2v12ZM4 8h16M7 13h1m8 0h1M6 17v4m12-4v4'],
  ['forum', 'Forum', 'M21 11a9 9 0 0 1-13 8l-6 3 2-6a9 9 0 1 1 17-5Z'],
  ['notes', 'Notes partagées', 'M14 2H5v20h14V7Zm0 0v6h5M8 12h8m-8 4h8'],
  ['cours', 'Mes cours', 'M12 5Q7 1 2 4v16q5-3 10 0 5-3 10 0V4q-5-3-10 1Zm0 0v15'],
]
function Icon({ path }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
}
export default function App() {
  const [active, setActive] = useState('campus')
  return <aside className="sidebar" aria-label="Menu Campus">
    <a className="brand" href="#campus" onClick={() => setActive('campus')}><span className="brand-mark">C</span>Campus</a>
    <nav aria-label="Navigation principale">
      {items.map(([id, label, path]) => <a key={id} href={`#${id}`} className={`nav-item ${active === id ? 'active' : ''}`} aria-current={active === id ? 'page' : undefined} onClick={() => setActive(id)}><Icon path={path} /><span>{label}</span></a>)}
    </nav>
    <div className="sidebar-footer">
      <a href="#parametres" className={`nav-item ${active === 'parametres' ? 'active' : ''}`} onClick={() => setActive('parametres')}><Icon path="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-3-5 1-2h4l1 2 3 1 2 3-1 3 2 2-1 4-3 1-1 3-4 1-2-2-3-1-1-3-3-1V9l2-2V4Z" /><span>Paramètres</span></a>
      <a className="profile" href="#profil" onClick={() => setActive('profil')}><span className="avatar">E</span><strong>Edson</strong><Icon path="m6 9 6 6 6-6" /></a>
    </div>
  </aside>
}
