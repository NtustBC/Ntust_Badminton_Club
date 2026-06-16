import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  CalendarDays,
  ChevronUp,
  Instagram,
  Mail,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import logoSrc from '../assets/club-logo-cropped.png'

const aboutCards = [
  {
    title: '蝛拙?閮毀蝭憟?,
    copy:
      '?箏?蝷曇玨??啣???霈??仿????撌脩???鞈賜?撽?蝷曉?質?曉?芸楛??憟?,
  },
  {
    title: '???冗蝢斗???,
    copy:
      '銝??嚗????芰毀?漱瘚??單??蝚砌?甈⊥?銝韏瑕??憭批振?質鋡急雿?,
  },
  {
    title: '?潮“?????,
    copy:
      '蝷曉????箸?銵?蝺氬?找漱瘚??砍?鞈?嚗??????脫郊??韏瑕遣蝡絲靘?,
  },
]

const registrationCards = [
  {
    id: 'club-signup',
    badge: '蝷曉??勗?',
    title: '??箇?憭抒噬?冗',
    copy:
      '?拙??喳摰???霅????冗隤脰?瘣餃???摮詻ㄐ?雿?∪?鋆⊥?蝛拙??噬??啜?,
    items: ['?啁???∠????', '蝷曉?瘣餃???啗?閮?銝剔恣??, '?舫?銵典摰??郊?勗?'],
    cta: '??蝷曉??勗?',
  },
  {
    id: 'class-signup',
    badge: '蝷曇玨?勗?',
    title: '?餉??祇梁冗隤脰?蝺渡??挾',
    copy:
      '隤脣????冗隤脣???嫣噶摰??游?犖?貉?蝺渡??批捆嚗?霈?銝甈∪撣剜????,
    items: ['瘥梯玨???曄閮?, '?臭??抒?摨血?蝯???, '敹恍???啗玨銵刻??挾'],
    cta: '??蝷曇玨?勗?',
  },
]

const notices = [
  {
    tag: '?砍?',
    date: '2026.06.18',
    title: '?砍飛?洵銝甈⊥?牧??撠蝬?憭扳??輒??',
    copy:
      '隤芣???隞晶蝷曉????孵??冗隤脣????砍飛??閬暑??甇∟??喳??亦噬?冗??摮貊?亙?氬?,
  },
  {
    tag: '蝷曇玨',
    date: '2026.06.21',
    title: '?望蝷曇玨?寧銝??湛?隢冗?∠??????????芸?',
    copy:
      '??啗矽?湛?????蝷曇玨?寡銝? 09:30 ???撌脣??隢???15 ??摰??勗??,
  },
  {
    tag: '瘣餃?',
    date: '2026.06.25',
    title: '?∪鈭斗?鞈賡??曉?????撠銝勗??,
    copy:
      '甇∟?撌脣摰??冗隤脩?蝷曉蝯??勗??漱瘚魚隞亦毀蝧?鈭蝤典??箔蜓嚗??菜??????,
  },
]

function App() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('about')
  const navRefs = useRef({})

  const navItems = useMemo(
    () => [
      { id: 'about', label: '??? },
      { id: 'club-signup', label: '蝷曉??勗?' },
      { id: 'class-signup', label: '蝷曇玨?勗?' },
      { id: 'notices', label: '?砍?' },
    ],
    [],
  )

  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter(Boolean)

    if (!('IntersectionObserver' in window) || sections.length === 0) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      {
        rootMargin: '-35% 0px -45% 0px',
        threshold: 0.05,
      },
    )

    sections.forEach((section) => observer.observe(section))

    return () => observer.disconnect()
  }, [navItems])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canUseWheelSmoothing = window.matchMedia('(pointer: fine)').matches

    if (prefersReducedMotion || !canUseWheelSmoothing) {
      return undefined
    }

    let currentY = window.scrollY
    let targetY = window.scrollY
    let animationFrame = null

    const maxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight)

    const tick = () => {
      currentY += (targetY - currentY) * 0.12

      if (Math.abs(targetY - currentY) < 0.4) {
        currentY = targetY
        window.scrollTo(0, currentY)
        animationFrame = null
        return
      }

      window.scrollTo(0, currentY)
      animationFrame = window.requestAnimationFrame(tick)
    }

    const requestScroll = (value) => {
      targetY = Math.min(Math.max(value, 0), maxScroll())
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(tick)
      }
    }

    const onWheel = (event) => {
      if (event.ctrlKey || loginOpen) {
        return
      }

      const activeElement = document.activeElement
      const isFormElement =
        activeElement &&
        (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.isContentEditable
        )

      if (isFormElement) {
        return
      }

      event.preventDefault()
      requestScroll(targetY + event.deltaY * 0.96)
    }

    const onScroll = () => {
      if (!animationFrame) {
        currentY = window.scrollY
        targetY = window.scrollY
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('scroll', onScroll)
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
      }
    }
  }, [loginOpen])

  useEffect(() => {
    document.body.classList.toggle('modal-open', loginOpen)
    return () => document.body.classList.remove('modal-open')
  }, [loginOpen])

  const scrollToSection = (sectionId) => {
    const target = document.getElementById(sectionId)
    const header = document.querySelector('.site-header')

    if (!target) {
      return
    }

    const offset = (header ? header.offsetHeight : 0) + 20
    const top = target.getBoundingClientRect().top + window.scrollY - offset

    window.scrollTo({ top, behavior: 'smooth' })
    setMobileOpen(false)
  }

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#top">
            <span className="brand-mark">
              <img alt="?箇?憭抒噬?冗 Logo" src={logoSrc} />
            </span>
            <span className="brand-copy">
              <p className="brand-title">?箇?憭抒噬?冗</p>
              <p className="brand-subtitle">NTUST BADMINTON CLUB</p>
            </span>
          </a>

          <nav className="site-nav" aria-label="銝駁??>
            {navItems.map((item) => (
              <button
                key={item.id}
                ref={(node) => {
                  navRefs.current[item.id] = node
                }}
                className={`nav-link ${activeSection === item.id ? 'is-active' : ''}`}
                onClick={() => scrollToSection(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <button
              className="login-button"
              onClick={() => setLoginOpen(true)}
              type="button"
            >
              ?餃
            </button>
            <button
              aria-expanded={mobileOpen}
              aria-label="???詨"
              className="menu-button"
              onClick={() => setMobileOpen((value) => !value)}
              type="button"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <div className={`mobile-nav ${mobileOpen ? 'is-open' : ''}`}>
          <div className="container mobile-nav-grid">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-link ${activeSection === item.id ? 'is-active' : ''}`}
                onClick={() => scrollToSection(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
            <button
              className="login-button"
              onClick={() => {
                setMobileOpen(false)
                setLoginOpen(true)
              }}
              type="button"
            >
              ?餃
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container">
            <div className="hero-grid">
              <div className="hero-copy-card">
                <div className="eyebrow">Campus Shuttle Rhythm</div>
                <h1 className="hero-title">
                  銝??閮毀????砍??賣?璆??蝢賜?蝷暸???                </h1>
                <p className="hero-body">
                  ???游◢?潮????港嗾瘛具?撖艾隞亦?乩? GitHub ?????亙??                  雿隞亙?銝敹恍?圈??潭??冗??冗隤脣???砍?嚗?靽?鈭???抒?皛曉?????                </p>
                <div className="hero-actions">
                  <button
                    className="cta-primary"
                    onClick={() => scrollToSection('club-signup')}
                    type="button"
                  >
                    蝡?
                    <ArrowRight size={18} />
                  </button>
                  <button
                    className="cta-secondary"
                    onClick={() => scrollToSection('about')}
                    type="button"
                  >
                    ??霅???                  </button>
                </div>
                <p className="hero-note">
                  ?脣???撌脣??亙像皛?扳????亥?蝵桀?憟賣?撠??恬??????摰????箝?                </p>
              </div>

              <div className="hero-brand-card">
                <div className="hero-logo-wrap">
                  <img alt="?箇?憭抒噬?冗銝餉?閬?Logo" src={logoSrc} />
                </div>
                <div className="hero-brand-details">
                  <p className="hero-brand-title">?箇?憭抒噬?冗 / NTUST Badminton Club</p>
                  <p className="hero-brand-copy">
                    隞乩???Logo 瘛梯??脩雿蜓?莎??擃??Ｗ??蝛押銋暹楊??閮??????航?憌暹批??? landing page??                  </p>
                </div>
              </div>
            </div>

            <div className="stats-strip">
              <div className="stats-grid">
                <div className="stat-item">
                  <p className="stat-label">?箏??</p>
                  <p className="stat-value">???/ ?勗? / ?砍?</p>
                </div>
                <div className="stat-item">
                  <p className="stat-label">???箄矽</p>
                  <p className="stat-value">蝪∪??撖艾帘摰?</p>
                </div>
                <div className="stat-item">
                  <p className="stat-label">?函蔡?孵?</p>
                  <p className="stat-value">GitHub Pages Ready</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-block" id="about">
          <div className="container">
            <div className="section-heading">
              <div className="section-kicker">???/div>
              <h2 className="section-title">霈?????蝔桃帘摰?甇詨惇???∪?蝭憟?/h2>
              <p className="section-description">
                ??憛??芯?蝝寧冗???????瘞?釭??皜?嚗?敺?蝺氬??冗蝢扎??????                ?見?圈脖??犖銝?舐?ㄐ?臭誑??????仿??ㄐ?拙???銝???              </p>
            </div>

            <div className="about-grid">
              {aboutCards.map((card, index) => (
                <article className="about-card" key={card.title}>
                  <div className="about-card-header">
                    <span className="section-kicker">ABOUT</span>
                    <span className="about-card-index">{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 className="about-card-title">{card.title}</h3>
                  <p className="about-card-copy">{card.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-block" id="club-signup">
          <div className="container">
            <div className="section-heading">
              <div className="section-kicker">?勗??亙</div>
              <h2 className="section-title">?冗???蝷曇玨?勗???嚗??皜???/h2>
              <p className="section-description">
                ?ㄐ銝?????雿??典?銝憛??皜?????亦冗???閮冗隤脯蝔桐???瘙?雿輻???澆停?仿??芸楛閰脣?芾ㄐ??              </p>
            </div>

            <div className="registration-grid">
              {registrationCards.map((card, index) => (
                <article
                  className={`registration-card ${index === 0 ? 'is-brand' : ''}`}
                  id={card.id}
                  key={card.title}
                >
                  <div className="registration-badge">
                    {index === 0 ? <Users size={16} /> : <CalendarDays size={16} />}
                    <span>{card.badge}</span>
                  </div>
                  <h3 className="registration-title">{card.title}</h3>
                  <p className="registration-copy">{card.copy}</p>
                  <ul className="registration-list">
                    {card.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <button
                    className={index === 0 ? 'signup-link' : 'class-link'}
                    onClick={() => setLoginOpen(true)}
                    type="button"
                  >
                    {card.cta}
                    <ArrowRight size={18} />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-block" id="notices">
          <div className="container">
            <div className="section-heading">
              <div className="section-kicker">??啣??/div>
              <h2 className="section-title">霈冗?∪??鞈?嚗??臬?餈瑁楝??/h2>
              <p className="section-description">
                ?砍???寞?皜????銵剁??交????摰寧?憟????拙??亙???敺銝憓?              </p>
            </div>

            <div className="notices-grid">
              {notices.map((notice) => (
                <article className="notice-card" key={notice.title}>
                  <div className="notice-meta">
                    <span>{notice.tag}</span>
                    <span>{notice.date}</span>
                  </div>
                  <h3 className="notice-title">{notice.title}</h3>
                  <p className="notice-copy">{notice.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-block" id="privacy">
          <div className="container">
            <div className="privacy-panel">
              <div className="registration-badge">
                <ShieldCheck size={16} />
                <span>?梁?甈蝑?/span>
              </div>
              <h3 className="privacy-title">甇??銝?敺??ㄐ?臭誑?曄冗???????舐窗?孵?隤芣???/h3>
              <p className="privacy-copy">
                ?桀??????蝑???蝵殷?蝑?蝣箄??迤???鈭?閮?嚗?鋆??湔??摰孵?胯?              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-panel">
            <div className="footer-grid">
              <div>
                <div className="footer-brand">
                  <img alt="?箇?憭抒噬?冗 Logo" src={logoSrc} />
                  <div>
                    <p className="footer-brand-title">?箇?憭抒噬?冗</p>
                    <p className="brand-subtitle">NTUST BADMINTON CLUB</p>
                  </div>
                </div>
                <p className="footer-brand-copy">
                  憒?雿迤?典??曄帘摰?閮毀蝭憟???韏瑟???鈭斗??冗蝢歹?甇∟?敺ㄐ??隤???                </p>
              </div>

              <div className="footer-meta">
                <div>
                  <p className="footer-contact-title">Contact</p>
                  <p className="footer-contact-copy">
                    雿隞交??ㄐ??甇??蝷曄黎????縑蝞晞?典?靽?蝪⊥???璆隞亦?仿???鞈?撅斤???                  </p>
                </div>

                <ul className="footer-links">
                  <li>
                    <a href="https://www.instagram.com/ntust_badminton/" target="_blank" rel="noreferrer">
                      <InstagramLink />
                    </a>
                  </li>
                  <li>
                    <a href="https://mail.google.com/mail/?view=cm&fs=1&to=ntustbc@gmail.com" target="_blank" rel="noreferrer">
                      <MailLink />
                    </a>
                  </li>
                </ul>

                <p className="footer-copyright">
                  穢 2026 ?箇?憭抒噬?冗 NTUST Badminton Club. All Rights Reserved.
                </p>

                <ul className="footer-policy-list">
                  <li>
                    <a href="#privacy">?梁?甈蝑?/a>
                  </li>
                  <li>
                    <a href="https://mail.google.com/mail/?view=cm&fs=1&to=ntustbc@gmail.com" target="_blank" rel="noreferrer">Gmail</a>
                  </li>
                  <li>
                    <a href="https://www.instagram.com/ntust_badminton/" target="_blank" rel="noreferrer">
                      IG
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <button
          aria-label="??銝"
          className="back-to-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          type="button"
        >
          <ChevronUp size={28} />
        </button>
      </footer>

      {loginOpen ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
          <button
            aria-label="???餃閬?"
            className="modal-backdrop"
            onClick={() => setLoginOpen(false)}
            type="button"
          />
          <div className="modal-dialog">
            <div className="modal-header">
              <div>
                <h2 className="modal-title" id="login-title">
                  ??餃
                </h2>
                <p className="modal-subtitle">
                  ?ㄐ???迤撘?亙???蝵殷?銋??臭誑銝脫蝷曉蝟餌絞??Google 銵典瘚???                </p>
              </div>
              <button
                aria-label="??"
                className="modal-close"
                onClick={() => setLoginOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <form
                className="form-grid"
                onSubmit={(event) => {
                  event.preventDefault()
                }}
              >
                <div className="form-field">
                  <label htmlFor="login-student-id">摮貉?</label>
                  <input id="login-student-id" placeholder="B11207001" type="text" />
                </div>
                <div className="form-field">
                  <label htmlFor="login-password">撖Ⅳ</label>
                  <input id="login-password" placeholder="隢撓?亙?蝣? type="password" />
                </div>
                <button className="login-button modal-submit" type="submit">
                  ?餃
                  <ArrowRight size={18} />
                </button>
                <p className="login-note">
                  ?桀???蝷箇??Ｚ?鈭??亙嚗迤撘?蝺??臭誑?亦?撖衣?亦頂蝯晞?                </p>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function InstagramLink() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 76, 129, 0.08)',
          color: '#0f4c81',
        }}
      >
        <Instagram size={16} />
      </span>
      Instagram
    </span>
  )
}

function MailLink() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 76, 129, 0.08)',
          color: '#0f4c81',
        }}
      >
        <Mail size={16} />
      </span>
      Gmail
    </span>
  )
}

export default App

